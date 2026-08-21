# Rediseño de los formularios de crear y editar referencias

Objetivo: reemplazar el layout de tres tarjetas apiladas (`Datos basicos` → `Operaciones de la referencia` → `Comparativo economico`) por un patrón único de **dos columnas con panel de economía fijo**, con captura de operaciones en línea y estado de progreso hacia «Guardar». El mismo patrón sirve para crear y para editar. En móvil el panel se convierte en barra fija inferior.

No cambies el modelo de datos, las rutas, los nombres de campos ni el payload que se envía. Es un cambio de UI y de composición.

## Archivos a tocar

| Archivo | Qué hacer |
| --- | --- |
| `resources/js/Pages/References/Create.tsx` | Reescribir el layout al patrón nuevo. Mantener `useForm`, `submit`, `bloquearEnvioConEnter`, `addOperation`, `removeOp`, `elegirImagen`, `handleOperationCreated` tal como están. |
| `resources/js/Pages/References/Edit.tsx` | Mismo layout que Create. **Añadir el detalle de operaciones** (hoy no lo tiene) y las piezas propias de edición descritas abajo. |
| `resources/js/Components/References/ReferenceFormLayout.tsx` | **Nuevo.** Shell de dos columnas: `children` a la izquierda, `aside` a la derecha (sticky), y en móvil el `aside` colapsa a barra inferior. Lo consumen Create y Edit. |
| `resources/js/Components/References/ReferenceFormSection.tsx` | **Nuevo.** Encabezado de sección: número en círculo, título, resumen a la derecha, y la regla que se desvanece. Reemplaza `<Card>` + `<CardHeader>` dentro del formulario. |
| `resources/js/Components/References/ReferenceOperationsTable.tsx` | **Nuevo.** Tabla de operaciones con la fila de captura en línea y la columna «% del costo». Extraída de lo que hoy está inline en `Create.tsx`. |
| `resources/js/Components/References/ReferenceUnitEconomicsCard.tsx` | Reescribir como **panel** (no tarjeta): margen unitario grande arriba, barra costo↔pago, totales del lote, y en Edit los bloques de producción registrada e historial. Quitar la calculadora libre de «Cantidad de unidades» (el lote ya da el total). |
| `resources/js/Components/References/ReferenceSaveChecklist.tsx` | **Nuevo.** Checklist «Falta para guardar» + el contador `n de 4` que consume el encabezado. |
| `resources/js/Components/Operations/OperationQuickCreateModal.tsx` | Ajustar al estilo del formulario nuevo (mismos radios, bordes y botón primario delineado). Sin cambios de comportamiento. |

## Estructura del layout (escritorio)

```
PageHeader propio del formulario (no el PageHeader genérico)
├── izquierda: breadcrumb · título · badge de estado · meta ("Editada hace 3 días por …")
└── derecha:  progreso/cambios · [Cancelar|Descartar] [Guardar]
────────────────────────────────────────────────────────────────
columna izquierda (flex: 1, min-width: 0)     │ aside 316px (sticky top: 0)
  1  Identidad                                │  Margen unitario
     imagen 104px + código + nombre           │  Lote de N unidades
     + descripción (span 2)                   │  [Edit] Producción registrada
  2  Dinero y lote                            │  [Edit] Historial
     pago · lote · estado (3 columnas)         │  [Create] Falta para guardar
  3  Operaciones                               │
     tabla con fila de captura en línea        │
```

- El shell es `display: flex`; la columna izquierda `flex: 1; min-width: 0`; el `aside` `width: 316px; flex-shrink: 0; position: sticky; top: 0; align-self: flex-start; border-left: 1px solid`.
- Las secciones se separan con `gap: 28px`, no con tarjetas. El padding del contenedor es `28px`.
- El encabezado de sección: círculo de 22px con el número, título 14px/500, resumen en 12px muted, y `<span>` que crece con `background: linear-gradient(90deg, <border>, transparent)` como regla que se desvanece.

## Sección 1 — Identidad

- Imagen: dropzone de 104×104 con borde de 1px (no `border-2 dashed`), radio 10px, icono + «Arrastra o elige». Debe aceptar arrastrar y soltar, no solo el input nativo. Nunca mostrar el `<input type="file">` crudo con «Ningún archivo seleccionado».
- Al lado: grid `150px 1fr` → `Código` (tabular-nums) y `Nombre`; `Descripción` ocupa las dos columnas, `rows={2}`, y su label lleva «— opcional» en tono muted.
- En **Edit**, si la referencia tiene producción registrada, `Código` se muestra bloqueado: borde `dashed`, fondo un paso más oscuro, candado a la derecha, y ayuda «Con producción registrada no se cambia.»

## Sección 2 — Dinero y lote

Grid de 3 columnas: `Valor unitario de pago`, `Cantidad total del lote`, `Estado`.

- Los textos de ayuda largos de hoy se recortan a una línea de 11px:
  - pago → «Lo que **reciben** por unidad entregada.»
  - lote → Create: «Tope de unidades por operación.» · Edit: «No puede bajar de **N** ya producidas.»
- En Edit, el campo pago muestra «Antes $ X · ver historial» y el lote modificado toma borde acento.
- `Estado` es la caja del switch: título «Activa», sub «Admite producción», switch 40×22 dentro del mismo borde que los demás campos, para que la fila lea como tres campos y no como dos campos + un switch suelto.
- En Edit, debajo de la fila va un aviso con borde izquierdo de 2px acento: «Esta referencia ya tiene **N unidades producidas**. Cambiar precios de operaciones altera el costo de aquí en adelante; lo ya registrado conserva el precio con el que se pagó.» — esto reemplaza el párrafo largo que hoy vive en el `CardHeader` del comparativo.

## Sección 3 — Operaciones

Este es el cambio de comportamiento importante: **desaparece el bloque de captura de arriba** (`Select` + `Precio` + `Minutos` + botón `Agregar` en un grid `1fr 160px 160px auto`). La captura pasa a ser la última fila de la tabla.

- Columnas: `Operación · Precio · Minutos · Dificultad · % del costo · ×`.
- `% del costo` = `precio de la línea / suma de precios`, dibujado como barra de 46px (`linear-gradient(90deg, accent P%, border P%)`) + el número. Es lo que responde «¿qué me está costando caro?» sin salir de la pantalla.
- Fila de captura (última, fondo `rgba(accent, .06)`): combobox con búsqueda por escritura + `Precio` y `Minutos` prellenados desde `base_price` / `estimated_minutes` de la operación elegida, dificultad calculada en vivo con `levelFromMinutes`, y **Enter agrega la línea y devuelve el foco al combobox** para capturar la siguiente. Con el foco dentro de esta fila, Enter no debe caer en `bloquearEnvioConEnter`: agrega la línea.
- Pie de la tabla: «Escribe para buscar la operación; Enter agrega la línea y deja el cursor listo para la siguiente.»
- El resumen de la sección va en su encabezado: «N líneas · X min · $ Y / u.» — así el costo unitario se ve sin bajar al comparativo.
- «Crear operación nueva» es un botón delineado de 28px dentro del encabezado de la sección, no un botón secundario suelto debajo del bloque de captura. Sigue abriendo `OperationQuickCreateModal` bajo `<Can permission="operations.index.create">`.
- En Edit, `Precio` de cada línea existente es editable en línea: input sin borde que revela borde al hover y acento al foco.
- Estado vacío (Create): en lugar de «Aun no agregaste operaciones» centrado en una tabla vacía, la tabla se rinde solo con la fila de captura, con foco puesto ahí.

## Panel derecho (`aside`)

Bloques separados por `border-bottom`, `padding: 18px 22px`, cada uno con un kicker de 11px en mayúsculas y `letter-spacing: .1em`.

1. **Margen unitario** — cifra a 34px/500 tabular-nums + `%` en pill. Debajo, barra apilada de 6px: `costo` en acento oscuro, `margen` en acento. Pie: «Costo $ X» ↔ «Pago $ Y». En Edit, línea extra: «Antes de tus cambios: $ X · −$ Y».
2. **Lote de N unidades** — Total pago, Total operacional, y Margen del lote destacado tras un `border-top`. Reemplaza la calculadora de cantidad libre.
3. **Producción registrada** (solo Edit) — «340 de 1.200», barra de 5px, y la restricción del lote en 11px.
4. **Historial** (solo Edit) — tres entradas `fecha · cambio · autor` + «Ver todo el historial». Si no hay endpoint de historial todavía, omite el bloque completo antes que inventar datos.
5. **Falta para guardar** (Create) — ítems con ✓ o casilla vacía: código y nombre, valor unitario de pago, cantidad del lote, imagen (marcada «— opcional»). El contador `n de 4` del encabezado sale de aquí; es la única fuente de verdad del progreso.

Cuando el margen sea negativo, el panel debe decirlo con palabras además del color («El costo operacional supera el pago»), no solo pintar la cifra en rojo.

## Móvil / tablet (≤ 640px)

Una sola columna; el `aside` se vuelve barra fija abajo.

- Encabezado compacto: ← · título 17px · «2 de 4» a la derecha, y debajo la barra de progreso de 4 segmentos de 3px.
- Alturas táctiles: inputs 44px, filas de switch y botones 48px. Los inputs numéricos a 16px para que iOS no haga zoom.
- «Dinero y lote» en 2 columnas (`minmax(0, 1fr) minmax(0, 1fr)`, con `min-width: 0` en los contenedores para que los campos no desborden) y el switch de estado en fila completa.
- Operaciones como tarjetas, no tabla: nombre + «6,0 min» + pill de dificultad a la izquierda; precio y «44% del costo» a la derecha. Agregar es un botón delineado punteado de 46px que abre una hoja inferior con el combobox, precio y minutos.
- Barra fija inferior: margen unitario 22px + `%`, barra apilada de 4px, y `[Ver detalle] [Guardar referencia]` en proporción 1:2. «Ver detalle» expande el comparativo completo (pago, costo, margen del lote y peso de cada operación en el costo).
- En **Edit móvil**, las secciones arrancan colapsadas como filas de 48px («Identidad · Camisa oxford ›», «Dinero y lote · editado ›», «Operaciones · 5 · $ 14.700 ›») con pill «editado» en las que cambiaron, y el comparativo abierto como tarjeta. Así editar un precio no obliga a recorrer el formulario entero.

## Estilo

Tokens del tema oscuro; en claro usa los pares equivalentes de la escala.

| Uso | Valor |
| --- | --- |
| Fondo de página | `#161826` |
| Superficie de campo / fila | `#1c1f30` |
| Superficie de encabezado / pie | `#1a1d2c` |
| Borde | `#2d3149` · borde de tabla `#24273a` |
| Texto | `#e9e9ed` · muted `#9a9db2` · sutil `#7c7f95` |
| Acento | `#9184d9` · sobre relleno `#cfc8f2` / `#b4abe6` |
| Radio | 8px campos · 10px contenedores · 7px controles pequeños |
| Tipografía | Inter (`--font-sans`, ya en `resources/css/app.css`) |

- **Los botones primarios son delineados, no rellenos**: `1px solid #9184d9` + `background: rgba(145,132,217,.12)` + texto `#cfc8f2`. Ajusta la variante `primary` de `Components/UI/Button.tsx` solo si decides aplicarlo en todo el producto; si no, pasa la clase desde estos formularios.
- Nada de sombras apiladas: la elevación es borde + oscuridad ambiental.
- Foco de teclado: `outline: 2px solid #9184d9; outline-offset: 2px`. Nunca el anillo azul del navegador.
- Toda cifra de dinero, minutos y unidades con `font-variant-numeric: tabular-nums` y `formatCurrency` / `Intl.NumberFormat('es-CO')`.
- Máximo dos pesos tipográficos: 400 y 500. Nada de `font-bold` en encabezados.

## Criterios de aceptación

1. Crear y editar comparten shell, secciones y panel; la única diferencia son los bloques marcados «solo Edit» y el checklist «solo Create».
2. Editar muestra y permite modificar el detalle de operaciones (hoy no lo hace).
3. Se puede agregar una operación completa sin usar el mouse: escribir → Tab → precio → Tab → minutos → Enter, y el foco vuelve al combobox.
4. El margen unitario y el % están visibles sin hacer scroll en cualquier punto del formulario, en escritorio y en móvil.
5. El encabezado dice siempre cuánto falta para poder guardar (Create) o cuántos cambios hay sin guardar (Edit).
6. En 390px de ancho ningún campo se desborda ni queda recortado; los objetivos táctiles miden ≥ 44px.
7. Enter sigue sin enviar el formulario, salvo en la fila de captura de operaciones, donde agrega la línea.
8. El payload de `references.store` y `references.update` es idéntico al actual.
