# Prompt de cambio — Nueva orden de compra al estilo POS

> **Contexto.** Proyecto "La Canasta" (Laravel 12 + Inertia 2 + React 19 + TypeScript + Tailwind 4,
> spatie/laravel-permission, multiempresa con sedes). La pantalla *Nueva orden de compra* hoy obliga a elegir
> proveedor y solo deja pedir lo que ese proveedor surte, con una lista de sugerencias diminuta y la mayor parte de
> la pantalla vacía. Este documento la reemplaza por una pantalla de trabajo rápida, con la misma mecánica del punto
> de venta: **buscar o escanear → tocar → ajustar cantidad → confirmar**.
>
> **Regla de oro:** no se entrega nada que no funcione. Ningún botón sin acción, ningún dato escrito en el `.tsx`,
> ninguna sugerencia que no salga de una consulta real.

---

## 1. El cambio de fondo

1. **El proveedor deja de filtrar el catálogo.** La cuadrícula muestra *todos* los artículos de la sede activa.
2. **El proveedor resalta.** Los artículos que ese proveedor surte se marcan con borde de acento y la etiqueta
   "Del proveedor"; los demás muestran a qué proveedor pertenecen.
3. **Se pueden pedir artículos de cualquier proveedor.** La orden los acepta; se avisa en ámbar cuántos no son del
   proveedor elegido y se ofrece **Separar**, que parte la orden en varias —una por proveedor— sin perder nada.
4. **Ordenamiento útil**: primero lo del proveedor y bajo mínimo, después lo del proveedor, después lo bajo mínimo
   de otros, y al final el resto. Nunca se esconde nada.
5. **Todo entra con cantidad sugerida**, editable con botones grandes.

---

## 2. Modelo de datos

### 2.1 Un artículo puede tener varios proveedores

**`product_suppliers`** (nueva) — `company_id`, `product_id`, `supplier_id`, `supplier_sku` (referencia del
proveedor), `last_cost` (bigInteger), `last_purchased_at`, `lead_time_days` (nullable), `is_primary` (bool).
Unique `['product_id','supplier_id']`. Índice `['company_id','supplier_id']`.

`products.supplier_id` se conserva como **proveedor principal** (atajo) y se mantiene sincronizado con la fila
`is_primary = true`. La pantalla resalta por `product_suppliers`, no por `products.supplier_id`: así un artículo que
surten dos proveedores se resalta con los dos.

### 2.2 Campos nuevos en `products`

`purchase_pack_size` (int, default 1) — unidades por empaque de compra; las cantidades sugeridas se redondean hacia
arriba a un múltiplo de este valor.
`reorder_multiplier` (decimal 4,2, default 2.00) — cuánto se pide respecto al mínimo (ver §3).

### 2.3 Cambios en la orden

**`purchase_orders`** gana:
`parent_order_id` (nullable, self, `nullOnDelete`) — de qué orden salió al separar,
`suggested_total` (bigInteger) — total estimado en el momento de crearla,
`source` (`manual`|`suggested`|`mixed`).
El `status` ya existente (`draft`|`sent`|`received`|`cancelled`) se mantiene: **Guardar como borrador** deja `draft`,
**Crear y enviar al proveedor** deja `sent`.

**`purchase_order_items`** gana:
`supplier_id` (nullable) — el proveedor de ese renglón en el momento de pedirlo,
`is_off_supplier` (bool) — si no es el proveedor de la orden,
`suggested_quantity` (decimal 12,3) — lo que sugirió el sistema, para comparar contra lo que realmente se pidió,
`stock_at_order` (decimal 12,3) y `min_at_order` (decimal 12,3) — foto del momento, para auditar después,
`origin` (`suggestion`|`search`|`scan`|`manual`).

---

## 3. Reglas de negocio

**Cantidad sugerida** (`PurchaseSuggestionService`):

```
falta      = max(0, minimo - existencia)
objetivo   = ceil(minimo * reorder_multiplier) - existencia
sugerido   = max(falta, objetivo, 0)
sugerido   = ceil(sugerido / purchase_pack_size) * purchase_pack_size
```

La consulta de artículos bajo mínimo usa `product_stocks` de la **sede activa**:
`quantity <= products.min_stock`, con `reserved_quantity` descontado.

**Costo sugerido**: `product_suppliers.last_cost` del proveedor de la orden; si ese proveedor nunca lo ha surtido,
el `last_cost` más reciente de cualquier proveedor; si tampoco existe, el `cost` del artículo. Siempre editable.

**Mezcla de proveedores**: permitida. Al guardar, cada renglón conserva su `supplier_id` y se marca
`is_off_supplier` cuando no coincide con el de la orden.

**Separar** (`PurchaseOrderSplitter::split`): agrupa los renglones por `supplier_id`, deja en la orden original los
del proveedor elegido y crea una orden nueva por cada proveedor distinto, con `parent_order_id` apuntando a la
original. Todo dentro de una transacción; si algo falla, no se parte nada.

**Recepción** (ya existente, no se toca salvo esto): al recibir, se actualiza `product_suppliers.last_cost` y
`last_purchased_at` del proveedor de esa orden, además del costo promedio del artículo.

**Lo que no se permite**: cantidad 0 o negativa, orden sin renglones, y artículos inactivos o de otra empresa.

---

## 4. Rutas

```
GET    compras/nueva                 PurchaseOrderController@create     permission:purchases.index.create
GET    compras/articulos             PurchaseOrderController@products   permission:purchases.index.create   (JSON)
POST   compras                       PurchaseOrderController@store      permission:purchases.index.create
POST   compras/{order}/separar       PurchaseOrderController@split      permission:purchases.index.create
GET    compras/sugerencias           PurchaseOrderController@suggestions permission:purchases.index.view    (JSON)
```

`compras/articulos` responde el catálogo de la sede activa paginado o filtrado por texto/código, con
`{id, name, sku, barcode, stock, min_stock, pack_size, suppliers:[{id,name,last_cost,is_primary}], suggested}`.
La búsqueda es del servidor (índice por `sku`, `barcode` y `name`), con *debounce* de 250 ms en el cliente.

Cuerpo de `POST /compras`:

```jsonc
{
  "supplier_id": 4,
  "expected_at": "2026-09-27",
  "note": "Entregar antes de las 9 a. m.",
  "status": "sent",                       // o "draft"
  "items": [
    { "product_id": 12, "quantity": 50, "unit_cost": 4200, "origin": "suggestion" },
    { "product_id": 31, "quantity": 24, "unit_cost": 9900, "origin": "scan" }
  ]
}
```

El servidor **recalcula** existencia, mínimo, sugerido y proveedor de cada renglón: los valores del cliente solo se
usan para cantidad y costo, y se validan (`quantity >= 1`, `unit_cost >= 0`).

---

## 5. Interfaz (referencia: 1440 px; el diseño está en el artboard «Compras · nueva orden»)

### 5.1 Estructura

Barra superior del back office con **Volver** y **Guardar como borrador**. Debajo, dos zonas:

**Izquierda (crece)**

1. **Franja de datos de la orden**, una sola línea: proveedor como **chips** (no un `select` escondido),
   entrega esperada y nota. Cambiar el chip de proveedor **no recarga ni vacía** la orden: solo cambia qué se resalta.
2. **Buscador grande con foco automático** (52 px) que acepta código de barras: al leer un código, el artículo entra
   con su cantidad sugerida y el campo se limpia. Al lado, el botón **"Agregar los N bajo mínimo"**.
3. **Chips de vista**: *Del proveedor · N*, *Bajo mínimo · N*, *Todo el catálogo · N*.
4. **Cuadrícula de artículos**, 4 columnas, tarjetas de 132 px que son botones completos:
   punto de color (verde normal, ámbar bajo mínimo, rojo agotado), SKU, etiqueta del proveedor,
   nombre, existencia contra mínimo, último costo y la acción (*Agregar 50* / *En la orden · 50*).
   Las del proveedor elegido llevan borde de acento; las que ya están en la orden, fondo de acento.

**Derecha (408 px), el "tiquete" de la compra**

Encabezado con el conteo, botón *Vaciar*; lista de renglones con nombre, nota contextual
("Bajo mínimo · quedan 6" o "Es de Lácteos del Valle"), botones de cantidad de 44 px, costo unitario editable y total
del renglón; al pie: aviso ámbar de mezcla con **Separar**, unidades, artículos distintos, **Total estimado** en
grande, **Crear y enviar al proveedor** y **Guardar como borrador**.

### 5.2 Atajos (el comprador no usa el ratón)

| Tecla | Acción |
|---|---|
| `F1` | Foco en el buscador / código de barras |
| `Enter` en el buscador | Agrega el primer resultado con su cantidad sugerida |
| `+` / `-` con un renglón enfocado | Sube o baja una unidad |
| `F4` | Agrega todos los que están bajo mínimo |
| `Esc` | Quita el foco del buscador |

### 5.3 Celular y tableta

- Debajo de 1024 px: la cuadrícula pasa a 2 columnas y el panel de la orden se vuelve una **hoja inferior**
  con el total siempre visible y un botón que la expande.
- Debajo de 640 px: una columna, tarjetas de fila completa, y el buscador fijo arriba.
- Todos los controles táctiles, 44 px mínimo. El escáner del teléfono usa la cámara (`BarcodeDetector`, con entrada
  manual como respaldo).

### 5.4 Correcciones concretas sobre la pantalla actual

1. Los datos de la orden dejan de ocupar una columna alta: pasan a una franja de una línea.
2. El vacío gigante desaparece: ese espacio es ahora el catálogo.
3. *Guardar como borrador* deja de verse deshabilitado (contraste real, borde visible).
4. Las sugerencias dejan de ser una tabla pequeña al fondo: se integran como chip de vista y como botón de acción.
5. Microcopia acentuada: "Los artículos bajo el mínimo…", "Artículos de la orden", "La orden está vacía",
   "ARTÍCULO", "EXISTENCIA", "MÍNIMO".
6. El botón principal solo se activa con al menos un renglón, y dice qué va a pasar.

---

## 6. Estados y validaciones de pantalla

| Situación | Qué se ve |
|---|---|
| Sin renglones | Vacío con instrucción, botón principal apagado |
| Artículo agotado | Punto rojo y existencia en rojo; igual se puede pedir |
| Artículo de otro proveedor en la orden | Nota ámbar en el renglón + franja "N artículos no son de este proveedor · Separar" |
| Sin sugerencias (nada bajo mínimo) | El botón "Agregar los N bajo mínimo" se oculta |
| Código escaneado que no existe | Aviso "No encontramos ese código" y opción de crear el artículo |
| Sede sin proveedores | Se pide crear un proveedor antes de continuar |

---

## 7. Pruebas obligatorias

```
PurchaseOrderCreateTest
  ✓ crea la orden con sus renglones y calcula el total estimado
  ✓ el catálogo devuelto NO está filtrado por proveedor
  ✓ marca is_off_supplier en los renglones de otro proveedor
  ✓ rechaza cantidad 0, orden vacía y artículos de otra empresa
PurchaseSuggestionTest
  ✓ el sugerido respeta mínimo, multiplicador y tamaño de empaque
  ✓ solo toma existencias de la sede activa
PurchaseOrderSplitTest
  ✓ separar crea una orden por proveedor y conserva el total sumado
  ✓ las órdenes hijas apuntan a la original con parent_order_id
PurchaseReceiveTest
  ✓ recibir actualiza last_cost del proveedor y el costo promedio del artículo
```

---

## 8. Fases

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **C1** | `product_suppliers`, campos nuevos, migración de datos desde `products.supplier_id` | Cada artículo conserva su proveedor actual como principal |
| **C2** | `PurchaseSuggestionService` y el endpoint de catálogo con búsqueda y código de barras | Buscar "crema" o escanear su código devuelve el artículo con su sugerido |
| **C3** | Pantalla nueva: chips de proveedor, cuadrícula, panel de la orden, atajos | Se arma una orden mezclando proveedores y se crea correctamente |
| **C4** | Separar en varias órdenes | Una orden mezclada se parte en dos y ambas quedan enlazadas |
| **C5** | Celular y tableta (hoja inferior, cámara) | Se arma y envía una orden completa desde un teléfono |

---

## 9. Definición de terminado

- [ ] El catálogo completo se ve siempre; el proveedor solo resalta y ordena.
- [ ] Se pueden agregar artículos de cualquier proveedor, con aviso y opción de separar.
- [ ] Un toque agrega con la cantidad sugerida; el código de barras funciona en escritorio y celular.
- [ ] El servidor recalcula sugerido, proveedor y existencias; no confía en el cliente.
- [ ] La pantalla se usa entera con teclado y también con el dedo (44 px).
- [ ] Microcopia acentuada, contraste mínimo 4.5:1, botón principal apagado cuando no hay renglones.
- [ ] `php artisan test` y `tsc --noEmit` en verde, con las pruebas del §7.
