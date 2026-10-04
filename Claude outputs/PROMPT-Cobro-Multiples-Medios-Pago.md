# Prompt de cambio — Cobro con varios medios de pago (POS)

> **Contexto.** El sistema de supermercado "La Canasta" (Laravel 12 + Inertia 2 + React 19 + TS + Tailwind 4,
> spatie/laravel-permission, multiempresa con sedes) ya tiene el punto de venta con una modal de cobro de
> **un solo medio de pago**. Este documento reemplaza esa modal: el cliente debe poder pagar **combinando varios
> medios** (por ejemplo $8.000 en efectivo y $4.200 con tarjeta), y la pantalla debe organizarlos con claridad.
>
> **Regla de oro, igual que en el prompt maestro: no se entrega nada que no funcione.** Nada de botones sin acción,
> nada de montos calculados en el `.tsx` que el servidor no vuelva a validar, nada de estados intermedios sin manejar.
>
> Si el proyecto aún no existe, este documento se aplica **sobre** el prompt maestro en la fase F7 (POS) y sustituye
> lo que allí se dice de la pantalla de cobro.

---

## 1. Qué cambia, en una frase

Una venta pasa de tener **un** pago a tener **de uno a cuatro** pagos (`sale_payments`), la modal se reorganiza en
*elegir medio → asignar monto → ver los pagos aplicados*, y la venta solo se confirma cuando la suma de los pagos
cubre el total.

---

## 2. Reglas funcionales (obligatorias)

1. Medios disponibles: `cash` (efectivo), `card` (tarjeta), `transfer` (transferencia), `credit` (crédito del cliente).
2. **Un pago por medio como máximo** en una venta (cuatro líneas posibles). Tocar de nuevo un medio ya usado no crea
   otra línea: selecciona la existente para editar su monto.
3. Al tocar un medio se le asigna automáticamente **lo que falte por cobrar**, acotado por su tope. Ese es el camino
   rápido: un toque = pago completo con ese medio.
4. **Topes por medio:**
   - `cash`: sin tope. Lo que exceda el faltante es **cambio**.
   - `card` y `transfer`: nunca superan el faltante (no existe "cambio" en esos medios).
   - `credit`: nunca supera `min(faltante, cupo_disponible)`, donde `cupo_disponible = credit_limit - balance`.
5. **Solo el efectivo genera cambio.** `change_amount` se guarda únicamente en la línea de efectivo:
   `change = max(0, suma_pagos - total)`.
6. La venta se confirma solo si: hay al menos un pago, `suma_pagos >= total`, y ningún pago viola su tope.
   Mientras no se cumpla, el botón **Confirmar la venta** queda inactivo (visiblemente apagado, no oculto) y se
   muestra el motivo en el aviso de la modal.
7. **Crédito:** solo con permiso `pos.sale.credit`, con cliente seleccionado, `credit_enabled = true`,
   `credit_blocked = false` y monto dentro del cupo. Si hay una línea de crédito, la venta queda
   `sales.status = credit`, `due_total = monto del crédito`, `due_date = hoy + credit_term_days`, y se suma a
   `customer_balances`. El resto de la venta (efectivo, tarjeta, transferencia) **sí** está pagado: `paid_total`
   es la suma de los pagos que no son crédito, acotada al total.
8. Si no hay línea de crédito: `sales.status = paid`, `paid_total = total`, `due_total = 0`.
9. Quitar un pago recalcula el faltante en el acto. Vaciar todos los pagos deja la modal en su estado inicial.
10. **El servidor recalcula todo.** Los montos que llegan del cliente se validan contra el total recalculado en el
    servidor a partir de los ítems; si no cuadran, la venta se rechaza con 422.

---

## 3. Base de datos

`sale_payments` ya existe con varias filas por venta. Se ajusta así:

```php
Schema::table('sale_payments', function (Blueprint $table) {
    $table->unsignedTinyInteger('sequence')->default(1)->after('sale_id'); // orden en que se aplicó
    $table->string('reference', 60)->nullable()->after('amount');          // voucher / comprobante
    $table->unique(['sale_id', 'method']);                                 // un pago por medio
});
```

Columnas finales: `sale_id`, `sequence`, `method`, `amount` (bigInteger), `reference`, `received_amount`
(solo efectivo: lo que entregó el cliente), `change_amount` (solo efectivo), `timestamps`.

**Invariante que se verifica en pruebas:** para toda venta no anulada,
`sum(sale_payments.amount) - change_amount(efectivo) == sales.total`.

Sin cambios en `sales` salvo el uso ya descrito de `paid_total` / `due_total`.

---

## 4. Backend

### 4.1 Contrato del endpoint

`POST /pos/sales` (permiso `pos.sale.create`).

```jsonc
{
  "customer_id": 12,              // null en venta de mostrador
  "register_session_id": 45,
  "items": [ { "product_id": 3, "quantity": 2, "unit_price": 4900, "discount": 0 } ],
  "payments": [
    { "method": "cash",   "amount": 8000, "received_amount": 10000 },
    { "method": "card",   "amount": 4200, "reference": "4821" }
  ],
  "note": null
}
```

Respuesta 201:

```jsonc
{
  "sale": { "id": 991, "number": "C1-000482", "total": 12200, "status": "paid",
            "paid_total": 12200, "due_total": 0, "change_amount": 0 },
  "receipt_url": "/pos/sales/991/receipt"
}
```

### 4.2 `StoreSaleRequest`

```php
'payments'                    => ['required', 'array', 'min:1', 'max:4'],
'payments.*.method'           => ['required', 'in:cash,card,transfer,credit', 'distinct'],
'payments.*.amount'           => ['required', 'integer', 'min:1'],
'payments.*.reference'        => ['nullable', 'string', 'max:60'],
'payments.*.received_amount'  => ['nullable', 'integer', 'min:0'],
```

`withValidator()` añade, con el total recalculado por `SaleTotalsCalculator`:

- `suma(amount) < total` → "Faltan $X por cobrar."
- cualquier `method != cash` cuya suma supere el total → "Solo el efectivo puede exceder el total."
- `credit` sin cliente → "Selecciona un cliente para vender a crédito."
- `credit` sin permiso `pos.sale.credit` → 403.
- `credit` con `credit_blocked` → "El crédito del cliente está bloqueado: {motivo}."
- `credit` mayor que el cupo disponible → "El crédito supera el cupo disponible ($X)."
- `received_amount` en efectivo menor que su `amount` → "El efectivo recibido es menor que el monto asignado."

### 4.3 `SaleService::register()`

Todo en **una** transacción, en este orden:

1. `lockForUpdate()` sobre el contador de la sede y generación de `sales.number`.
2. Recalcular totales con `SaleTotalsCalculator` (los precios llegan del servidor, no del cliente).
3. Verificar stock de cada ítem (`StockService`), respetando `allow_negative_stock`.
4. Volver a comprobar el cupo del cliente **dentro** de la transacción, con `lockForUpdate()` sobre
   `customer_balances` (dos cajas pueden vender a crédito al mismo cliente a la vez).
5. Crear `sale`, `sale_items`, y una fila de `sale_payments` por medio, con `sequence` incremental.
6. Calcular `change_amount` sobre la línea de efectivo y guardarlo ahí.
7. Descontar stock y escribir `stock_movements` (`reference` = la venta).
8. Si hay crédito: actualizar `customer_balances.balance` y `oldest_due_date`.
9. Devolver la venta con sus pagos.

`CreditService::assertCanTake($customer, $amount)` es el único sitio que decide si el crédito cabe: lo usan el POS,
el checkout de la tienda online y las pruebas.

### 4.4 Efectos en otras pantallas (obligatorio actualizarlas)

- **Cierre de caja** (`RegisterSessionService`): el efectivo esperado suma **solo las líneas `cash`** de las ventas
  del turno, no el total de las ventas. El desglose por medio de pago del informe Z se calcula desde `sale_payments`.
- **Informes / medios de pago**: agrupar por `sale_payments.method`, no por venta. Una venta combinada aporta a dos
  columnas.
- **Detalle de la venta** y **tiquete impreso**: listan los pagos línea por línea
  (`Efectivo $ 8.000`, `Tarjeta $ 4.200 · voucher 4821`) y, si hubo, el cambio entregado.
- **Cartera**: solo entra el monto de la línea `credit`, nunca el total de la venta.
- **Tienda online (v1)**: sigue con un solo medio de pago. No se toca su checkout en este cambio.

---

## 5. Frontend — nueva modal de cobro

Componente: `resources/js/pages/Pos/components/PaymentDialog.tsx`, abierto desde `Pos/Sale`.
Tema oscuro (`data-theme="dark"`), tokens del sistema (`--accent #2FBE7E`, `--surface #151A1D`, etc.).

### 5.1 Estructura visual (medidas exactas)

Modal de **980 px** de ancho, radio 20, `--surface`, borde `--line`, sombra del sistema, sobre velo
`rgba(6,10,12,.66)`.

```
┌─ Encabezado (padding 18/24, borde inferior) ───────────────────────────────┐
│ "Cobrar"  (Bricolage 21/700)            Total a cobrar   $ 12.200 (mono 30)│
│ Ticket #4822 · Cliente · "puedes combinar varios medios"              [ X ]│
├───────────────────────────── cuerpo (flex) ────────────────────────────────┤
│ IZQUIERDA 566 px, borde derecho          │ DERECHA (resto)                 │
│                                          │                                 │
│ PASO 1 · MEDIOS DE PAGO                  │ PAGOS APLICADOS      2 de 4     │
│ rejilla 2×2, botones de 70 px:           │ ┌ EF  Efectivo        $ 8.000 ┐ │
│  [icono] Efectivo        $ 8.000         │ │     Cambio $ 0     [✎] [🗑] │ │
│  [icono] Tarjeta         $ 4.200         │ └──────────────────────────────┘ │
│  [icono] Transferencia   Asignar         │ (vacío: recuadro punteado con   │
│  [icono] Crédito         Asignar         │  "Todavía no hay pagos…")       │
│                                          │                                 │
│ PASO 2 · MONTO  (de: Efectivo)           │ Total            $ 12.200       │
│ ┌ Efectivo            $ 8.000 ┐ (acento) │ Pagado           $ 12.200       │
│ Máximo $ 4.200 / Sin tope                │ ────────────────────────────    │
│ [Exacto][20.000][50.000][100.000]        │ Falta por cobrar / Cambio  $ 0  │
│ teclado 3×4: 7 8 9 / 4 5 6 / 1 2 3 /     │ (bloque de crédito si aplica)   │
│              00 0 C   (52 px de alto)    │ aviso contextual                │
│                                          │ [Volver al tiquete][Confirmar]  │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

Reglas visuales:

- Botón de medio: 70 px de alto, chip de icono 34 px, nombre 14/600, pista 11 px, y a la derecha **el monto asignado**
  en mono o la palabra "Asignar". Sin monto: borde `--line-2`. Con monto: borde `--accent`. Seleccionado para editar:
  borde `--accent` + fondo `--accent-soft` + texto `--accent`.
- Teclado y botones táctiles: mínimo 44 px (el teclado usa 52 px). Sin medio seleccionado, el teclado se ve
  atenuado (opacidad .45, `cursor: not-allowed`) y no responde.
- Cifras siempre en IBM Plex Mono con `tabular-nums`.
- El bloque de resumen cambia de etiqueta y color: **"Falta por cobrar"** en `--warn` mientras falte,
  **"Cambio a entregar"** en `--accent` cuando ya cubra el total.
- Aviso contextual (una sola línea, con icono):
  | Estado | Texto | Color |
  |---|---|---|
  | Sin pagos | "Agrega al menos un medio de pago para poder confirmar." | neutro |
  | Falta | "Faltan $X por asignar. Puedes repartirlos en otro medio de pago." | `--warn` |
  | Crédito excedido | "El crédito supera el cupo disponible ($X). Baja el monto o pide autorización." | `--danger` |
  | Sobra efectivo | "Entrega $X de cambio y confirma la venta." | `--accent` |
  | Exacto | "El pago cuadra con el total. Confirma para imprimir el tiquete." | `--accent` |
- Bloque de crédito (solo si hay línea de crédito): deuda actual, monto a crédito de esta venta, **nuevo saldo** y
  **cupo disponible después**; en rojo con el título "Supera el cupo aprobado" cuando corresponda.

### 5.2 Estado del componente

```ts
type Method = 'cash' | 'card' | 'transfer' | 'credit';
type Payment = { method: Method; amount: number; reference?: string; receivedAmount?: number };

const [payments, setPayments] = useState<Payment[]>([]);
const [active, setActive]     = useState<Method | null>(null);
const [buffer, setBuffer]     = useState('');            // dígitos que se están escribiendo
```

Derivados (`useMemo`, nunca en el render suelto):

```ts
paid       = sum(payments.amount)
remaining  = max(0, total - paid)
change     = max(0, paid - total)
creditUsed = payments.find(p => p.method === 'credit')?.amount ?? 0
available  = customer.creditLimit - customer.balance
limitFor(m)= m === 'cash'   ? null
           : m === 'credit' ? Math.min(remainingExcluding(m), available)
           :                  remainingExcluding(m)
canConfirm = payments.length > 0 && paid >= total && creditUsed <= available
```

Al escribir con el teclado, el monto se recorta al tope del medio activo (`clamp`), sin mensajes de error molestos:
sencillamente no pasa del máximo, y la pista bajo el paso 2 dice cuál es.

### 5.3 Teclado físico (el cajero no usa el ratón)

| Tecla | Acción |
|---|---|
| `F1` | Foco en el código de barras (pantalla de venta) |
| `F12` o `Enter` en el tiquete | Abrir la modal de cobro |
| `1` … `9`, `0`, `00` | Escribir el monto del medio activo |
| `Backspace` | Borrar el último dígito |
| `E` / `T` / `R` / `C` | Agregar efectivo / tarjeta / transferencia / crédito |
| `Enter` | Confirmar, si `canConfirm` |
| `Esc` | Volver al tiquete (sin perder los pagos ya asignados) |

Los atajos se registran con `useEffect` **solo mientras la modal está montada**, y se limpian al desmontar.

### 5.4 Envío

Un único `router.post(route('pos.sales.store'), payload, { preserveScroll: true })`.
Mientras se envía, el botón muestra estado de carga y se bloquea (evita el doble cobro).
Con 201 se pasa a la pantalla de **venta registrada**, que muestra el número del tiquete, el desglose
`Efectivo $ 8.000 · Tarjeta $ 4.200`, el cambio y los botones Reimprimir / Nueva venta.
Con 422 se muestran los errores del servidor **dentro** de la modal, sin perder los pagos ya escritos.

---

## 6. Casos límite que deben estar resueltos

1. Cambiar la cantidad de un artículo con la modal abierta: se recalcula el total y los topes; si algún pago quedó
   por encima, se recorta y se avisa.
2. Quitar el pago que estaba activo: `active` vuelve a `null` y el teclado se atenúa.
3. Efectivo mayor que el total con tarjeta también asignada: el cambio sale **solo** de la línea de efectivo.
4. Crédito por un monto parcial (mitad efectivo, mitad crédito): la venta queda `status = credit` con
   `paid_total` = la parte pagada y `due_total` = la parte a crédito.
5. Cliente sin crédito o bloqueado: el botón de crédito aparece deshabilitado con el motivo como `title` y
   `aria-disabled`, no invisible.
6. Dos cajas cobrando a crédito al mismo cliente a la vez: gana la primera transacción; la segunda recibe 422 con
   el cupo actualizado.
7. Sesión de caja cerrada mientras la modal estaba abierta: 422 "La caja ya fue cerrada"; se redirige a la apertura.

---

## 7. Pruebas obligatorias

```
SplitPaymentTest
  ✓ registra una venta con efectivo + tarjeta y crea dos filas en sale_payments
  ✓ la suma de los pagos menos el cambio es igual al total de la venta
  ✓ rechaza (422) cuando la suma de los pagos es menor que el total
  ✓ rechaza cuando tarjeta o transferencia exceden el total
  ✓ el cambio se guarda solo en la línea de efectivo
  ✓ rechaza dos pagos del mismo medio en una venta
CreditSplitTest
  ✓ efectivo + crédito deja status=credit, paid_total y due_total correctos
  ✓ rechaza cuando el crédito supera el cupo disponible
  ✓ rechaza si el usuario no tiene el permiso pos.sale.credit
RegisterClosingTest
  ✓ el efectivo esperado del cierre solo cuenta las líneas cash
ReportPaymentMethodsTest
  ✓ una venta combinada aporta a dos medios en el informe
```

---

## 8. Definición de terminado

- [ ] La modal permite combinar los cuatro medios, con montos editables y eliminables, y se ve como el §5.1.
- [ ] El botón de confirmar solo se activa cuando el pago cubre el total; el motivo siempre está visible.
- [ ] Toda regla del §2 se valida **también** en el servidor (probado con una petición directa al endpoint).
- [ ] `sale_payments` guarda una fila por medio, con referencia y cambio donde corresponde.
- [ ] Cierre de caja, informes, tiquete, detalle de venta y cartera ya reflejan los pagos combinados.
- [ ] Atajos de teclado funcionando y limpiados al cerrar la modal.
- [ ] `php artisan test` y `tsc --noEmit` en verde; las pruebas del §7 incluidas.
