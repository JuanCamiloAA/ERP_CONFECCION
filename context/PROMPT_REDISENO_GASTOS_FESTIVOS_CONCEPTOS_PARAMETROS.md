# Rediseño de Gastos, Categorías de gastos, Conceptos de nómina, Festivos y Parámetros Legales — especificación de implementación

Aplica al proyecto `ERP_CONFECCION` (Laravel + Inertia + React + TypeScript + Tailwind v4).

Objetivo: llevar los **cinco módulos que quedaron en la piel vieja** (`PageHeader` + `Card` + `Table` + `Badge` + `@heroicons` + escala `slate-*`) a la misma piel de Empleados, Producción, Operaciones y Anticipos (clases `emp-*` de `resources/css/module-ui.css`), rediseñar sus formularios de creación y edición, y resolver los problemas de uso concretos que cada módulo tiene hoy.

Referencia de diseño: `ERP Pantalla.dc.html` (13 pantallas navegables desde el sidebar; props `theme`, `mobile`, `consolidada`).

Módulos incluidos:

| Módulo | Rutas | Páginas hoy |
| --- | --- | --- |
| Listado de gastos | `expenses.*` | `Index`, `Create`, `Edit`, `Show` |
| Categorías de gastos | `expense-categories.*` | `Index`, `Create`, `Edit` |
| Conceptos de nómina | `payroll-concepts.*` | `Index`, `Create`, `Edit` |
| Festivos | `holidays.*` | `Index` |
| Parámetros Legales de Nómina | `payroll-legal-parameters.*` | `Index`, `Create`, `Edit` |

---

## 0. Reglas heredadas (no negociables)

1. `import '../../../css/module-ui.css';` en cada página de los cinco módulos. **Sin hojas nuevas.**
2. Colores solo por variable `--emp-*` (`bg`, `surface`, `field`, `field-alt`, `bar`, `border`, `row`, `text`, `muted`, `subtle`, `faint`, `accent`, `accent-on`, `accent-line`, `accent-fill`, `accent-tint`, `row-hover`, `danger`, `ok`). **Cero `slate-*` / `indigo-*` / `amber-*` / hex crudo.** Esto elimina, entre otras cosas, el aviso ámbar de Parámetros Legales y el `file:bg-indigo-600` del input de comprobante.
3. Pesos 400 y 500 únicamente; jerarquía por tamaño y espacio.
4. Primarios delineados (`emp-btn emp-btn-primary`), nunca rellenos sólidos.
5. Elevación = borde (`emp-card`), sin sombras apiladas.
6. Iconos **Phosphor** (`@phosphor-icons/react`), 13–17px. **Se retiran todos los `@heroicons` de estos módulos** (el sidebar de `AppLayout` no se toca en esta entrega).
7. Secciones de formulario con regla que se desvanece (`EmployeeFormSection` de `Components/Employees/EmployeeFormSection.tsx`), **no** `Card` + `CardHeader`.
8. Armazón de formulario: `EmployeeFormLayout` + `EmployeeFormNav` + `EmployeeAsideCard` (`Components/Employees/EmployeeFormLayout.tsx`).
9. Campos: `EmpInput`, `EmpSelect`, `EmpTextarea`, `EmpSwitch`, `EmpField` de `Components/UI/ModuleFields.tsx`. Nunca `Components/UI/Input.tsx` ni `Switch.tsx` (escala slate).
10. Foco temático, nunca el anillo del navegador (ya lo da `.emp-form`).
11. Móvil: tarjetas en vez de tabla bajo `lg`, objetivos ≥44px, barra fija inferior con la acción primaria, `pb-28` en el contenedor para dejarle hueco.
12. Tablas: rejilla `grid` con `gridTemplateColumns` compartido entre cabecera y filas (patrón `ADVANCE_GRID`), separador `emp-row-sep`, realce `emp-hover-row`. **No** `<table>`.
13. `Can`, `route()`, los nombres de ruta y los nombres de permiso existentes se conservan.
14. `isConsolidatedView` sigue ocultando toda acción de escritura; además ahora se **anuncia** con un `emp-note` en la cabecera del listado (hoy el usuario no sabe por qué desaparecieron los botones).
15. Los filtros aplican al cambiar (debounce 300 ms en los buscadores). Ningún botón «Filtrar».

---

## 1. Archivos

### Nuevos

| Archivo | Qué es |
| --- | --- |
| `resources/js/Components/Expenses/ExpenseFilterBar.tsx` | Buscador + segmentado de periodo + selector de categoría + contador y total |
| `resources/js/Components/Expenses/ExpenseMonthGroup.tsx` | Grupo de mes con cabecera de totales (`groupByMonth`) |
| `resources/js/Components/Expenses/ExpenseRow.tsx` | Fila de escritorio + `EXPENSE_GRID` + `ExpenseActionsMenu` |
| `resources/js/Components/Expenses/ExpenseCard.tsx` | Tarjeta de móvil |
| `resources/js/Components/Expenses/ReceiptChip.tsx` | Pastilla PDF / Imagen / **Falta** |
| `resources/js/Components/Expenses/ReceiptField.tsx` | Zona de adjunto (arrastrar, cámara, archivo) + vista del adjunto existente |
| `resources/js/Components/Expenses/ExpenseImpactCard.tsx` | Panel «Impacto en el mes» del formulario |
| `resources/js/Components/Expenses/QuickCaptureSheet.tsx` | Hoja inferior de captura rápida (móvil) |
| `resources/js/Components/Catalog/CatalogFormLayout.tsx` | Armazón compartido por los formularios de categoría y de concepto |
| `resources/js/Components/Catalog/CatalogOrderField.tsx` | Reemplazo del campo numérico `sort_order`: lista real con ▲▼ |
| `resources/js/Components/Catalog/CatalogPreviewCard.tsx` | «Cómo se verá» (pastillas del selector real) |
| `resources/js/Components/Catalog/CatalogUsageCard.tsx` | «Uso» (conteo, total, último uso) |
| `resources/js/Components/Holidays/HolidayYearCalendar.tsx` | Cuadrícula de 12 meses con festivos marcados |
| `resources/js/Components/Holidays/HolidayList.tsx` | Vista lista agrupada por mes |
| `resources/js/Components/Holidays/HolidayDetailCard.tsx` | Detalle del festivo seleccionado |
| `resources/js/Components/Holidays/HolidayManualForm.tsx` | Alta manual (fecha + nombre) |
| `resources/js/Components/PayrollLegalParameters/LegalParameterActiveCard.tsx` | Tarjeta «Vigente hoy» con valores efectivos |
| `resources/js/Components/PayrollLegalParameters/LegalParameterTramoCard.tsx` | Tramo de la línea de vigencias |
| `resources/js/Components/PayrollLegalParameters/NightBandField.tsx` | Franja nocturna con barra de 24 h |
| `resources/js/Components/PayrollLegalParameters/LegalSimulationCard.tsx` | Simulación en vivo de valores/hora |
| `resources/js/Components/PayrollLegalParameters/LegalCompareCard.tsx` | Deltas frente al tramo vigente |
| `resources/js/lib/expenses.ts` | `receiptKind`, `groupExpensesByMonth`, `periodRange` |
| `resources/js/lib/holidays.ts` | `buildMonthGrid`, `weekdayName`, `isShifted` |
| `resources/js/lib/legalParameters.ts` | `hourlyValue`, `surchargeValue`, `suggestedDivisor`, `nightSpanHours` |

### Reescritos

- `Pages/Expenses/Index.tsx`, `Create.tsx`, `Edit.tsx`, `Show.tsx`
- `Pages/Expenses/Categories/Index.tsx`, `Create.tsx`, `Edit.tsx`
- `Pages/PayrollConcepts/Index.tsx`, `Create.tsx`, `Edit.tsx`
- `Pages/Holidays/Index.tsx`
- `Pages/PayrollLegalParameters/Index.tsx`, `Create.tsx`, `Edit.tsx`
- `Components/PayrollLegalParameters/PayrollLegalParameterFields.tsx` (pasa de 6 `Card` a 6 `EmployeeFormSection`)

### Backend

- `ExpenseController` — métricas del listado, filtro por periodo, exportación con el filtro vigente, endpoint de captura rápida.
- `ExpenseCategoryController` — `month_total` por categoría, `toggleActive`, `reorder`.
- `PayrollConceptController` — `adjustments_count`, `adjustments_total`, `last_used_at`, `toggleActive`, `reorder`.
- `HolidayController` — respuesta con `original_date` y `source`, `last_synced_at`.
- `PayrollLegalParameterController` — `active` (tramo que rige hoy) y `resolved` (valores efectivos).
- `routes/web.php` — rutas nuevas listadas en §8.

### No se toca

`module-ui.css` (ya tiene todo lo necesario), `AppLayout.tsx`, `PayrollCalculationService`, las migraciones existentes (todo lo nuevo es derivado o columna opcional, ver §8.4).

---

## 2. Listado de gastos — `Pages/Expenses/Index.tsx`

### 2.1 El problema de fondo

Hoy la pantalla es una tabla de 8 columnas con dos columnas de fecha (`expense_date` y `created_at`), sin un solo total. El usuario que entra a «Gastos» quiere saber **cuánto se gastó este mes**, y eso no aparece en ninguna parte. En móvil la tabla es ilegible. El comprobante —que es obligatorio al crear— no tiene forma de verse si falta en registros viejos.

| Hoy | Después |
| --- | --- |
| Sin totales | Tres métricas: gasto del mes, mes anterior con variación, acumulado del año |
| Filas planas sin jerarquía temporal | Agrupadas por mes con total por grupo |
| `created_at` como columna | Pasa a `title` de la fila y a la ficha; libera 150px |
| Tabla comprimida en móvil | Tarjetas |
| Comprobante = badge + icono de enlace | `ReceiptChip` con tres estados, incluido **Falta** en `emp-pill-warn` |
| Registrar gasto = formulario de escritorio | Botón «Capturar» en la barra móvil: foto → monto → categoría |
| Vista consolidada sin explicación | `emp-note` que dice por qué no hay acciones |

### 2.2 Props

```ts
interface Props {
    expenses: PaginatedResponse<ExpenseListRow>;
    categoryOptions: { id: number; name: string; is_active: boolean }[];
    filters: {
        search: string;
        category_id: number | null;
        period: 'mes' | 'trimestre' | 'anio' | 'todos';
        date_from: string | null;
        date_to: string | null;
    };
    metrics: {
        month_total: number;
        month_count: number;
        month_categories: number;
        prev_month_total: number;
        year_total: number;
        year_months: number;
    };
}
```

### 2.3 Estructura

1. **Contenedor**: `emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8`.
2. **Cabecera**: `h1` 24px «Gastos»; descripción 13px: «Todo lo que sale de la caja del taller, con su comprobante. Lo que se registra aquí alimenta el costo del mes.» A la derecha «Exportar» (`DownloadSimple`, `emp-btn emp-btn-sm`) y «Registrar gasto» (`emp-btn emp-btn-sm emp-btn-primary`, `Plus`), oculta en móvil.
3. **Aviso de vista consolidada** (solo si `isConsolidatedView`): `emp-note` — «Vista consolidada de super administrador: se listan los gastos de todas las empresas y las acciones de escritura quedan deshabilitadas. Selecciona una empresa en el encabezado para registrar o editar.»
4. **Tres métricas** (`emp-card p-[17px]`, kicker `emp-kicker`, valor 27px `leading-none tabular-nums`):
   - **Gasto de {mes}** — valor en `--emp-accent-on`; meta «{month_count} gastos · {month_categories} categorías con movimiento».
   - **Mes anterior** — meta «{signo}{pct}% frente a {mes anterior}».
   - **Acumulado {año}** — meta «Promedio mensual {…} · {year_months} meses cerrados».
   En móvil, fila con scroll horizontal (`-mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3`).
5. **`ExpenseFilterBar`**, pegajosa en móvil (`sticky top-16 … sm:static`):
   - Buscador `emp-field pl-8` («Buscar descripción, proveedor o nota...»), debounce 300 ms, busca en `description` **y** `notes`.
   - Segmentado `emp-seg` de 300px: **Este mes | Trimestre | Año | Todos** (por defecto «Este mes»; hoy no hay filtro temporal y el listado arranca con todo).
   - Select `emp-field w-[210px]` de categoría con `CaretDown` 13px, oculto en móvil (vive en la hoja de filtros).
   - A la derecha, `text-[12px]` en `--emp-subtle`: «{n} gastos · {suma del filtro}».
   - El rango `date_from` / `date_to` deja de ser dos inputs sueltos: se abre desde el segmentado «Todos» → «Rango…».
6. **Grupos por mes** (`ExpenseMonthGroup`): cabecera 11px mayúscula `tracking-[0.09em]` con «{mes} {año}» + meta «· {n} gastos · {total}».
   - **Escritorio** (`hidden lg:block`): rejilla `EXPENSE_GRID = '92px 200px 1fr 132px 118px 150px 76px'` → Fecha · Categoría · Descripción · Monto (derecha) · Comprobante · Registró · acciones. La categoría va como `emp-pill`; bajo la descripción, la nota en 11.5px `--emp-subtle`. Con `isConsolidatedView`, la empresa va como segunda línea de la celda de categoría (**no** una columna nueva: la rejilla no se deforma).
   - **Móvil** (`flex flex-col gap-2 lg:hidden`): `ExpenseCard` — fecha 11px, descripción 14px, categoría en pastilla, monto 15px a la derecha, y pie con `ReceiptChip` + autor.
7. **Vacío**: `emp-card p-6 text-center` — «No hay gastos con este filtro.» + «Limpiar filtros» subrayado en `--emp-accent-on`.
8. **Paginación**: patrón de `Advances/Index.tsx` (rango + `CaretLeft` / números / `CaretRight`, activo con `emp-seg-on`).
9. **Barra móvil fija** (`Can permission="expenses.index.create"`): dos botones — «Capturar» (`Camera`, `emp-btn`) abre `QuickCaptureSheet`; «Registrar» (`Plus`, `emp-btn emp-btn-primary`) va al formulario completo.

### 2.4 Menú de acciones (`ExpenseActionsMenu`)

Patrón `AdvanceActionsMenu` (Headless UI `Menu`, `anchor="bottom end"`, `emp-card w-56 py-1`):
- Ver detalle (`ArrowUpRight`) → `expenses.show`.
- Ver comprobante (`Eye`) → abre `receipt_url` en pestaña nueva. **Deshabilitado con leyenda si no hay comprobante.**
- Editar (`PencilSimple`) → `expenses.edit`, bajo `expenses.index.edit`.
- Archivar (`Trash`, `--emp-danger`) → `ConfirmDialog`, bajo `expenses.index.delete`. Mensaje: «El gasto se archiva (eliminación suave): deja de sumar en los reportes pero queda en la auditoría con su comprobante.»

### 2.5 Captura rápida (`QuickCaptureSheet`) — solo móvil

Hoja inferior (`fixed inset-0 z-60`, panel `rounded-t-[18px]`, fondo `rgba(15,23,42,.6)` con `backdrop-filter: blur(2px)`), dos pasos:

1. **Foto del comprobante** — botón de 200px de alto, borde `dashed`, `Camera` 34px en `--emp-accent-line`; `<input type="file" accept="image/*" capture="environment">`. `emp-note`: «El comprobante es obligatorio. Con la foto ya guardada, el monto y la categoría se pueden completar después desde el listado.»
2. **Monto y categoría** — adjunto resumido en fila con `Image` + nombre + «Cambiar»; monto con prefijo `$` y tres montos frecuentes en `emp-pill` de 32px; categorías activas como `emp-day` / `emp-day-on` (44px de alto). Nota viva: «Se registra {monto} en {categoría} con fecha de hoy. La descripción se puede completar luego desde el listado.»

Pie fijo: «Cancelar» (`flex-1`) + «Guardar {monto}» (`flex-2`, `emp-btn-primary`).

`POST expenses.quick-store` con `receipt`, `amount`, `category_id`, `expense_date = today`. `description` se autocompleta con `"{categoría} · captura rápida"` y el gasto queda marcado `needs_detail = true` para que el listado lo muestre con `ReceiptChip` normal pero la descripción en `--emp-subtle` y una pastilla «Completar».

---

## 3. Gasto: crear y editar — `Pages/Expenses/Create.tsx` y `Edit.tsx`

Armazón `EmployeeFormLayout` con `header`, `nav`, `aside` y `mobileBar`. Un solo `<form onSubmit>` envolviendo el layout, `post(..., { forceFormData: true })`.

### 3.1 Cabecera

`sticky top-0 z-30`, fondo `--emp-bar`, borde inferior `--emp-border`, `px-4 py-3 sm:px-[34px] sm:py-4`:
- Kicker `emp-kicker`: «Gastos · Nuevo» / «Gastos · Editar».
- `h1` 20px: «Registrar gasto» / la descripción del gasto que se edita.
- Dos `emp-pill`: «Suma al gasto de {mes} {año}» (o «Registrado el {fecha}» al editar) y «Comprobante obligatorio».
- Acciones a la derecha, ocultas en móvil: «Cancelar» (`emp-btn emp-btn-ghost`, `ArrowLeft`) y «Registrar gasto» / «Guardar cambios» (`emp-btn emp-btn-primary`, `Check`, `disabled={processing}`).

### 3.2 Índice lateral (`EmployeeFormNav`)

```ts
const EXPENSE_SECTIONS = [
    { id: 'que',          label: 'Qué se pagó' },
    { id: 'cuando',       label: 'Cuándo' },
    { id: 'comprobante',  label: 'Comprobante' },
    { id: 'detalle',      label: 'Detalle' },
];
```

**Cambio respecto a Empleados:** el ítem se marca `emp-nav-on` cuando la sección **está completa**, no cuando está a la vista, y bajo la lista va una línea 11px en `--emp-subtle` con lo que falta: «Falta completar comprobante, detalle.» / «Todo listo para guardar.»

### 3.3 Secciones

**1 · Qué se pagó** (`requirement="required"`)
- Categoría: **chips `emp-day` / `emp-day-on`**, no un `<select>`. Son 5–8 opciones y en móvil un desplegable es un paso extra por nada. `emp-help`: «Solo categorías activas.» + enlace subrayado «Administrar el catálogo» → `expense-categories.index`.
- Si `categories.length === 0`: `emp-note` con el enlace a crear la primera categoría y el botón de guardar deshabilitado (se conserva la regla actual).
- Monto: `EmpInput` con `prefix="$"`, `inputMode="numeric"`, `max-w-[340px]`, y `emp-help` viva: «{monto formateado} en pesos colombianos. Sin IVA discriminado: se registra el valor pagado.»

**2 · Cuándo** (`required`)
- `EmpInput type="date"` `max-w-[340px]`.
- Tres atajos en `emp-pill` de 28px: **Hoy · Ayer · Fin del mes pasado**.
- `emp-help` que cambia de sentido: si la fecha cae en el mes en curso, «Cae en {mes}: entra en el cierre de costos de este mes»; si es de un mes anterior, «Ojo: es de un mes ya cerrado. El reporte de ese mes cambia al guardar.»

**3 · Comprobante** (`required`) — `ReceiptField`
- **Sin adjunto**: zona de 132px con borde `dashed`, `Paperclip` 26px, «Arrastra el archivo o toca para elegirlo» + «PDF, JPG, PNG o WEBP · máx. 10 MB»; debajo, dos botones al 50% — «Tomar foto» (`capture="environment"`) y «Elegir archivo». Soporta `dragover` / `drop`.
- **Con adjunto**: fila de 12px de relleno con miniatura 44×52 (`FilePdf` o `Image` sobre `--emp-accent-fill`), nombre, «{tipo} · {tamaño} · adjunto el {fecha}», y dos botones — «Ver» y «Reemplazar».
- Al editar, el adjunto existente se muestra así; «Reemplazar» limpia el campo y vuelve a la zona de arrastre. **No se pierde el original hasta guardar.**

**4 · Detalle** (`requirement` = «Descripción obligatoria»)
- `EmpTextarea` «Descripción / concepto», `rows={2}`, `emp-help`: «Es lo que se lee en el listado y en el reporte de costos. Sé concreto: qué se compró y a quién.»
- `EmpTextarea` «Notas», `rows={2}`, placeholder «Número de factura, guía, contrato…».

**Solo en `Edit`: sección «Eliminar gasto»** — título en `--emp-danger`, texto explicando la eliminación suave y botón `emp-btn emp-btn-danger` con `Trash` → `ConfirmDialog`.

### 3.4 Panel derecho

1. **«Impacto en el mes»** (`ExpenseImpactCard`) — kicker «{mes} {año} · se recalcula al escribir»; valor 24px en `--emp-accent-on` con el nuevo total del mes; línea de apoyo «{ya registrados} + {este gasto}»; regla; y tres pares etiqueta/valor: mes anterior, variación en %, y participación de la categoría elegida («{n}% del mes»). Al editar, el gasto en curso se **excluye** de la base para que el total no se cuente dos veces.
2. **«Antes de guardar»** — cuatro ítems con `CheckCircle` / `Circle`: categoría, monto, comprobante, descripción. Cada uno muestra el valor cuando ya está resuelto.
3. **Solo en `Edit`: «Auditoría»** — Registró (usuario · `created_at`), Última edición (usuario · `updated_at`), Empresa.

### 3.5 Barra móvil

`mobileBar` con «Cancelar» (`flex-1`) y «Registrar gasto» / «Guardar cambios» (`flex-[2]`, `emp-btn-primary`).

### 3.6 `Pages/Expenses/Show.tsx`

Misma piel: cabecera con monto 27px, categoría y fecha en pastillas; visor del comprobante embebido (`<iframe>` para PDF, `<img>` con `ImageLightbox` para imagen); tarjeta de auditoría; acciones «Editar» y «Archivar» según permisos.

---

## 4. Categorías de gastos y Conceptos de nómina

Los dos módulos son **el mismo patrón de catálogo**: nombre, descripción, activo/inactivo, orden, y un conteo de uso que decide si se puede borrar. Comparten `CatalogFormLayout`, `CatalogOrderField`, `CatalogPreviewCard` y `CatalogUsageCard`; se diferencian en las columnas del listado y en el campo `code` (solo Conceptos).

### 4.1 El problema de fondo

| Hoy | Después |
| --- | --- |
| Columna «Orden» con un número que no dice nada | Reordenar con ▲▼ en la propia fila (`reorder`) |
| Estado = `Badge` de solo lectura; hay que entrar al formulario para desactivar | **Interruptor en la fila** (`toggleActive`, `preserveScroll`) |
| «Gastos: 24» sin contexto | Conteo + **participación en el mes** con barra de 6px |
| Conceptos: solo «Uso en nóminas» | Conteo + total pagado en el año + último uso |
| Se ofrece «Eliminar» y el servidor lo rechaza | El botón lleva `title` con el motivo y el formulario explica que se desactive |
| `sort_order` numérico a ciegas en el formulario | Lista real donde el registro se mueve dentro de sus hermanos |
| No se ve el efecto de lo que se está creando | «Cómo se verá»: las pastillas del selector real, con la nueva resaltada |

### 4.2 Listado — `Categories/Index.tsx`

- Cabecera: `h1` «Categorías de gastos»; descripción «El catálogo con el que se clasifica cada gasto. El orden de esta lista es el orden en que aparecen al registrar.»
- **Franja de resumen** en un solo `emp-card` de `p-[14px_17px]`, cuatro pares kicker/valor de 18px: Categorías · Activas · Con movimiento en {mes} · Gasto de {mes}. (Cuatro números en una franja, no cuatro tarjetas: es un catálogo, no un tablero.)
- Filtros: buscador + `emp-seg` **Activas | Inactivas | Todas** + contador «{n} de {total} categorías».
- Rejilla `CATEGORY_GRID = '34px 1fr 92px 176px 116px 76px'` → ▲▼ · Categoría (nombre 14px + descripción 11.5px) · Gastos (derecha) · Participación en {mes} (barra 6px `--emp-accent-line` sobre `--emp-row` + «{total} · {n}%») · Estado (interruptor 36×20 + etiqueta) · acciones.
- Fila inactiva: `emp-row-off` (opacidad 0.62).
- Móvil: tarjetas con nombre, descripción, barra + «{total} en {mes} · {n} gastos», e interruptor de 40×22 con área táctil de 44px.
- Pie: `emp-note` «Una categoría con gastos asociados no se puede eliminar: desactívala y deja de aparecer al registrar, sin perder el histórico.»
- Barra móvil fija con «Nueva categoría».

### 4.3 Listado — `PayrollConcepts/Index.tsx`

Igual, con estas diferencias:
- Descripción: «Bonificaciones y ajustes positivos que se pueden sumar a una nómina. Aquí solo se define el catálogo; el valor se escribe en cada nómina.»
- Franja de resumen: Conceptos · Activos · Ajustes en {año} · Pagado en {año}.
- Rejilla `CONCEPT_GRID = '1fr 116px 92px 148px 104px 112px 68px'` → Concepto · Código (`emp-pill` en tipografía monoespaciada 11px) · Nóminas (derecha) · Pagado {año} (derecha) · Último uso · Estado · acciones.
- Sin reordenar en la fila (el orden pesa menos aquí); se mantiene en el formulario.
- Pie: `emp-note` «Los conceptos son solo positivos: descuentos y anticipos viajan por su propio módulo. Desactivar un concepto no cambia las nóminas ya liquidadas.»

### 4.4 Formularios (`Categories/Create|Edit`, `PayrollConcepts/Create|Edit`)

`CatalogFormLayout` = `EmployeeFormLayout` sin índice lateral (dos secciones no lo justifican), con `aside` y `mobileBar`.

**Cabecera**: kicker «Categorías de gastos · Nueva» / «Conceptos de nómina · Editar», `h1` 20px, y una `emp-pill`: «Clasifica gastos de esta empresa» / «Ajuste positivo en nómina».

**1 · Identidad** (`required`)
- Nombre: `emp-help` «Es el texto que verá quien registre un gasto. Corto y sin abreviar.» / «…quien agregue el ajuste dentro de una nómina.»
- **Solo Conceptos** — Código: input en mayúsculas (`[A-Z0-9]`) junto a un botón «Sugerir» (`MagicWand`) que compone el código con las dos primeras palabras significativas del nombre (`BONPROD` de «Bonificación por productividad»). `emp-help`: «Opcional, para cruzar con la contabilidad.»
- Descripción: `EmpTextarea rows={3}`, `emp-help` «Se lee al elegir en el formulario: dice qué entra y qué no entra aquí.»

**2 · Disponibilidad y orden** (`optional`)
- `EmpSwitch` «Activa/Activo» con descripción que cambia según el valor: encendido «Aparece al registrar un gasto.» / apagado «No aparece al registrar; los gastos ya registrados no cambian.»
- `CatalogOrderField`: caja `rounded-[12px]` con borde y fondo `--emp-field-alt`, una fila por hermano (posición + nombre) y el registro en curso resaltado con `emp-seg-on` y dos botones ▲▼ de 26px. `emp-help`: «Reemplaza el campo numérico de orden: se mueve dentro de la lista real, no a ciegas.» Al guardar se envía `sort_order = posición`.

**Solo en `Edit`: sección «Eliminar»** — texto que explica el bloqueo real («No se puede eliminar: hay {n} gastos en esta categoría. Desactívala para que deje de aparecer sin tocar el histórico.») y el botón deshabilitado cuando `count > 0`.

**Panel derecho**
1. **«Cómo se verá»** — kicker «Selector de categoría al registrar un gasto» / «Selector de concepto al agregar un ajuste en la nómina», y hasta 6 `emp-pill` con la lista real; la que se está editando en `emp-pill-accent`.
2. **Solo en `Edit`: «Uso»** — Gastos registrados / Total en {año} / Último gasto (o Nóminas con este concepto / Total pagado / Último uso).
3. **«Antes de guardar»** — nombre, descripción (recomendado) y «Queda en la posición {n} de la lista».

---

## 5. Festivos — `Pages/Holidays/Index.tsx`

### 5.1 El problema de fondo

Hoy son tres `Card` apiladas —selector de año, alta manual, tabla— y la tabla es una lista de 19 filas de la que no se saca ninguna lectura. Un calendario de festivos se lee en un calendario: la pregunta real es «¿qué semanas del año tienen puente?».

| Hoy | Después |
| --- | --- |
| Año en un `Input type="number"` + botón «Ver año» | Paso de año con ‹ › y recarga inmediata |
| Solo tabla | **Calendario de 12 meses** con conmutador Calendario / Lista |
| «Trasladado: Sí» sin decir desde cuándo | «Trasladado desde {fecha original}» en pastilla y en el detalle |
| El alta manual ocupa una tarjeta a todo el ancho | Panel derecho, junto a la sincronización |
| «Sincronizar año» sin decir qué hace ni cuándo se hizo | Tarjeta con la última sincronización y qué recalcula |
| Sin nada que explique la Ley Emiliani | Detalle del día seleccionado con la consecuencia en nómina |

### 5.2 Props

```ts
interface Props {
    holidays: {
        id: number;
        date: string;
        name: string;
        original_date: string | null;   // ← nuevo: de qué fecha se trasladó
        is_emiliani_shifted: boolean;
        source: 'calculated' | 'manual';
    }[];
    filters: { year: number };
    lastSyncedAt: string | null;
}
```

### 5.3 Estructura

Layout de dos columnas (`erp-row`): contenido + `aside` de 292px pegajoso; en móvil, una sola columna con el `aside` al final.

1. **Cabecera**: `h1` «Festivos»; descripción «Calendario colombiano con la Ley Emiliani aplicada. De aquí sale el recargo dominical y festivo de la nómina por horas.» A la derecha: paso de año (caja con borde, ‹ 2026 ›, `router.get` al cambiar) y `emp-seg` de 190px **Calendario | Lista**.
2. **Franja de resumen** (`emp-card`, cuatro valores de 18px): Festivos {año} · Trasladados (Emiliani) · Manuales · Caen en jornada (lunes a viernes).
3. **Leyenda** (fila con borde inferior, 11px `--emp-subtle`): tres muestras de 20×16 — festivo de ley (`--emp-accent-fill` + borde `--emp-accent`), trasladado al lunes (además `box-shadow: inset 0 -2px 0 var(--emp-accent-line)`), agregado a mano (borde `dashed`).
4. **Vista calendario**: `grid` `repeat(auto-fit, minmax(196px, 1fr))` de 12 `emp-card p-3`. Cada mes: nombre 12.5px + «{n} festivos» a la derecha; cuadrícula de 7 columnas con cabecera `L M M J V S D` en 10px `--emp-faint`; celdas de 26px, `tabular-nums`. Domingo sin festivo en `--emp-faint`. Semana que empieza en **lunes**. Cada día festivo es un `<button>` con `title={name}` que selecciona el día.
5. **Vista lista**: grupos por mes (misma cabecera 11px que en Gastos); fila `flex` de 10px — fecha 13px + día de la semana 11px en columna de 96px, nombre 14px, pastilla «Trasladado desde {fecha}» si aplica, pastilla de origen (`emp-pill-accent` para manual), y `Trash` **solo** en los manuales.
6. **Panel derecho**:
   - **Detalle del día** (solo si hay selección): fecha + día de la semana en kicker, nombre 15px, pastillas de origen y traslado, y el porqué: «La Ley 51 de 1983 traslada este festivo al lunes siguiente. La nómina liquida el recargo en el lunes, no en la fecha original.» / «Fecha fija por ley: no se traslada. Las horas trabajadas ese día llevan recargo dominical y festivo.»
   - **Sincronización**: «Última sincronización: {fecha} · {n} festivos en {año}»; botón `emp-btn-primary` a todo el ancho con `ArrowsClockwise` → `Check` + «Sincronizado {año}» al terminar; nota: «Recalcula los 18 festivos de ley y aplica el traslado al lunes cuando la fecha no cae en lunes. Los festivos manuales no se tocan.»
   - **Agregar festivo manual**: fecha + nombre + botón «Agregar», deshabilitado (`emp-btn` sin `primary`) hasta que ambos estén; `emp-help` viva: «Se agrega el {fecha} y queda marcado como manual: la sincronización no lo borra.»

---

## 6. Parámetros Legales — `Pages/PayrollLegalParameters/Index.tsx`

### 6.1 El problema de fondo

Hoy es una tabla de 7 columnas donde una celda dice `35% / 25% / 75% / 75%` y el encabezado explica el orden entre paréntesis. Nadie puede auditar eso. Y sobre todo: **no se sabe qué tramo rige hoy** ni qué valores está usando la nómina en este momento.

| Hoy | Después |
| --- | --- |
| Cuatro porcentajes apilados en una celda | Tarjeta por tramo con rejilla de 6 datos rotulados |
| No se sabe qué tramo aplica hoy | **Tarjeta «Vigente hoy»** con los valores efectivos y de dónde vienen |
| Los porcentajes no dicen cuánto es en dinero | Cada porcentaje viene con su valor/hora sobre un salario de referencia |
| Aviso legal en ámbar (fuera de la paleta) | `emp-note` con borde `--emp-danger` y `color-mix` al 8% |
| Tramos globales y de empresa mezclados sin jerarquía | Empresa primero, globales atenuados con `emp-row-off` |

### 6.2 Props

```ts
interface Props {
    parameters: LegalParameterRow[];      // + scope: 'global' | 'company'
    active: LegalParameterRow;            // ← nuevo: el que rige hoy
    isSuperAdmin: boolean;
    salaryExample: number;                // ← nuevo: base para los valores/hora
}
```

Resolución del tramo vigente (backend, `PayrollLegalParameterController`): de los tramos cuyo rango cubre `today`, gana el de la empresa activa; si no hay, el global. Es la misma regla que ya aplica el cálculo de nómina — **exponerla es el punto de la pantalla**.

### 6.3 Estructura

1. **Cabecera**: `h1` «Parámetros legales de nómina»; descripción «Jornada, franja nocturna, recargos, horas extra e inasistencias que rigen la liquidación de la modalidad “Por horas (legal)”.» Acción «Nuevo tramo».
2. **Aviso legal**: `emp-note` con `border-left-color: var(--emp-danger)` y `background: color-mix(in srgb, var(--emp-danger) 8%, transparent)`, icono `Scales` 18px, y el texto actual conservado —incluida la aclaración de que el descuento por inasistencia **no** es el tope del 20% del art. 113 CST— con la frase clave en `<strong>` sobre `--emp-danger`.
3. **«Vigente hoy · {fecha}»** (`emp-card p-[17px]`): título «Jornada de {n} horas · divisor {n}»; pastillas «Tramo de esta empresa» (`emp-pill-accent`) y «Desde {fecha} · indefinido»; botón «Editar tramo vigente». Rejilla `repeat(auto-fit, minmax(132px, 1fr))` con seis datos, cada uno kicker + valor 17px + nota 11px:
   - Jornada semanal → «Divisor mensual {n}»
   - **Hora ordinaria** (`salaryExample / divisor`) → «Sobre {salario} de ejemplo»
   - Franja nocturna → «Recargo {n}%»
   - Extra diurna → «{valor} por hora»
   - Extra nocturna → «{valor} por hora»
   - Dominical / festivo → «{valor} por hora»
   Pie separado por borde: «Tu empresa tiene tramo propio desde el {fecha}, así que este manda sobre los tramos globales. Si se elimina, la nómina vuelve al tramo global vigente en cada fecha.»
4. **Tramos de vigencia**: cabecera 11px + meta «· {n} tramos · los globales aplican a toda empresa sin tramo propio». Una `LegalParameterTramoCard` por tramo (`emp-card p-[14px_16px]`, los no vigentes con `emp-row-off`):
   - Cabecera: rango de fechas 14px, pastilla de alcance (`emp-pill-accent` si es de la empresa), pastilla «Vigente» con `Check` si es el activo; debajo, `legal_reference` en 11.5px.
   - Acciones: `PencilSimple` + `Trash` si `scope === 'company'` o `isSuperAdmin`; si no, «Solo lectura» en 11px `--emp-faint`.
   - Rejilla `repeat(auto-fit, minmax(112px, 1fr))` con seis pares: Jornada («42 h / 210»), Nocturno («21:00–06:00»), Recargo noct., Extra d. / n., Dom-festivo, Inasistencia («100% activo» / «Desactivado»).

---

## 7. Tramo: crear y editar — `PayrollLegalParameterFields.tsx`

Las seis `Card` pasan a seis `EmployeeFormSection` numeradas, dentro de `EmployeeFormLayout` con índice lateral y panel de simulación.

### 7.1 Índice lateral

```ts
const LEGAL_SECTIONS = [
    { id: 'vigencia',      label: 'Vigencia' },
    { id: 'jornada',       label: 'Jornada' },
    { id: 'nocturno',      label: 'Franja nocturna' },
    { id: 'recargos',      label: 'Recargos y extras' },
    { id: 'inasistencias', label: 'Inasistencias' },
    { id: 'referencia',    label: 'Referencia legal' },
];
```

Bajo la lista, botón «Cargar valores de ley» (`emp-btn emp-btn-sm w-full`) que rellena 35 / 25 / 75 / 75 / 2 h / 12 h, con la nota «Rellena los porcentajes con los del CST vigente. Igual hay que revisarlos.»

### 7.2 Secciones

**1 · Vigencia** — `effective_from` y `effective_to` (`emp-help` «Vacío = indefinido, hasta que otro tramo lo reemplace»). `emp-note` viva: si el rango cubre hoy, «Este tramo cubre hoy: al guardar, la próxima nómina se liquida con estos valores»; si no, «Este tramo no cubre la fecha de hoy: entra en vigor cuando la nómina caiga dentro del rango.» Si se solapa con otro tramo del mismo alcance, el aviso pasa a `--emp-danger` y nombra el tramo en conflicto.

**2 · Jornada** — `weekly_legal_hours` con sufijo «horas» y tres presets en `emp-pill` (**48 h · 44 h · 42 h**, la transición de la Ley 2101 de 2021), que además fijan el divisor. `monthly_hours_divisor` con `emp-help` «Con jornada de {n} h el divisor habitual es {n×5} ({n} × 5)» y, si no coincide, un botón «Usar {sugerido}». La incoherencia jornada/divisor es el error real de esta pantalla: 42 h con divisor 220 paga todas las horas mal y hoy nada lo advierte.

**3 · Franja nocturna** — `night_start_time` y `night_end_time` y, debajo, **barra de 24 h** (`NightBandField`): caja de 34px con borde y fondo `--emp-field-alt`, y la franja pintada en `--emp-accent-fill` con bordes `--emp-accent-line`; si cruza la medianoche se pintan dos tramos (desde el inicio hasta 24:00 y desde 00:00 hasta el fin). Escala `00 06 12 18 24` en 10px `--emp-faint`. `emp-help`: «{n} horas de franja nocturna (cruza la medianoche). Toda hora dentro de la franja lleva el recargo nocturno.»

**4 · Recargos y horas extra** — rejilla `repeat(auto-fit, minmax(190px, 1fr))` con los seis campos existentes; cada porcentaje lleva sufijo dentro del campo y `emp-help` con **el valor en dinero** («Hora nocturna: $10.437», «$9.664 por hora»). `emp-note` al pie con el recordatorio de la autorización del Ministerio del Trabajo, reformulado: «El sistema no verifica ese trámite: los topes de aquí solo avisan cuando una jornada los supera.»

**5 · Descuento por inasistencia** — `EmpSwitch` (pista en `--emp-danger` cuando está encendido, no en acento: es una decisión con consecuencias). Debajo, el caveat legal en `emp-note` con borde `--emp-danger`. El campo de porcentaje aparece con `emp-reveal` y `disabled` cuando el interruptor está apagado; su `emp-help` dice cuánto es en dinero: «Un día hábil sin marcación descuenta $54.117.»

**6 · Referencia legal** — `EmpTextarea rows={2}`, placeholder «Ej. Ley 2101 de 2021 — jornada de 42 horas desde julio de 2026», `emp-help` «Se muestra bajo la vigencia en el listado: es lo que permite auditar por qué el tramo dice lo que dice.»

### 7.3 Panel derecho

1. **«Simulación»** (`LegalSimulationCard`) — input «Salario base mensual» con prefijo `$` (arranca en `salaryExample`) y siete pares etiqueta/valor que se recalculan a cada tecla:
   - Hora ordinaria = `salario / divisor`
   - Hora nocturna (+{n}%) = ordinaria × (1 + n/100)
   - Extra diurna (+{n}%), Extra nocturna (+{n}%), Dominical y festivo (+{n}%)
   - Día de salario = `salario / 30`
   - Día ausente (−{n}%) — solo si el descuento está activo
   Pie: «Es una simulación de referencia sobre el salario que escribas: la nómina real usa el salario de cada empleado y sus horas marcadas.»
2. **«Frente al tramo vigente»** (`LegalCompareCard`) — kicker con los valores del tramo activo y cuatro deltas: jornada semanal, divisor, hora ordinaria (en pesos) y recargo nocturno (en puntos porcentuales). Los deltas distintos de cero en `--emp-accent-on`; los iguales, «igual» en `--emp-text`.
3. **«Antes de guardar»** — cuatro ítems: fecha de inicio, coherencia jornada/divisor (`Warning` si no cuadra), referencia legal escrita, y el estado del descuento por inasistencia (`Warning` + «confírmalo con tu asesor» cuando está activo).

---

## 8. Backend

### 8.1 `ExpenseController`

- `index`: además de lo actual, `metrics` (§2.2) y filtro `period` resuelto en servidor (`mes` = mes en curso, `trimestre` = últimos 3 meses naturales, `anio` = año en curso, `todos` = sin límite; `date_from`/`date_to` siguen ganando si vienen). El buscador pasa a cubrir `description` **y** `notes`. `with('category', 'creator', 'company')`, `withCount` no aplica.
- `export`: reutiliza el filtro vigente igual que `advances.export` — lo que se ve es lo que se descarga.
- `quickStore` (nuevo): valida `receipt` (obligatorio), `amount`, `category_id`; `expense_date = today()`; `description = "{categoría} · captura rápida"`; marca `needs_detail`.
- `show`: `receipt_url`, `receipt_mime`, autor y fechas de auditoría.

### 8.2 `ExpenseCategoryController`

- `index`: `withCount('expenses')` + `month_total` (suma de gastos del mes en curso por categoría) + `month_grand_total` para calcular la participación en el front.
- `toggleActive` (nuevo, `PATCH`): invierte `is_active`, responde con `preserveScroll`.
- `reorder` (nuevo, `POST`): recibe `[{id, sort_order}]` y persiste en una transacción.

### 8.3 `PayrollConceptController`

- `index`: `adjustments_count`, `adjustments_total` (suma de los ajustes del año en curso) y `last_used_at` (máximo `created_at` de los ajustes).
- `toggleActive` y `reorder`, igual que en categorías.

### 8.4 `HolidayController`

- `index`: agrega `original_date` y `lastSyncedAt`.
- **Migración nueva** (única de la entrega): `holidays.original_date` (`date`, nullable) y `holiday_syncs.synced_at` — o, si se prefiere no tocar el esquema, calcular `original_date` en el servicio de sincronización y devolverlo sin persistir. El front solo necesita el dato en la respuesta.
- `sync`: conserva los manuales; responde con el conteo y la marca de tiempo.

### 8.5 `PayrollLegalParameterController`

- `index`: agrega `active` (tramo resuelto para hoy con la regla empresa > global) y `salaryExample` (SMLMV configurado o el mínimo vigente).
- `store` / `update`: validación nueva — **no se permiten dos tramos del mismo alcance con rangos solapados**; el mensaje nombra el tramo en conflicto y su rango.

### 8.6 Rutas nuevas (`routes/web.php`)

```php
Route::post('expenses/quick', [ExpenseController::class, 'quickStore'])->name('expenses.quick-store');
Route::patch('expense-categories/{category}/toggle', [ExpenseCategoryController::class, 'toggleActive'])->name('expense-categories.toggle');
Route::post('expense-categories/reorder', [ExpenseCategoryController::class, 'reorder'])->name('expense-categories.reorder');
Route::patch('payroll-concepts/{concept}/toggle', [PayrollConceptController::class, 'toggleActive'])->name('payroll-concepts.toggle');
Route::post('payroll-concepts/reorder', [PayrollConceptController::class, 'reorder'])->name('payroll-concepts.reorder');
```

Permisos: `toggle` y `reorder` reutilizan `*.edit`; `quick-store` reutiliza `expenses.index.create`.

---

## 9. Criterios de aceptación

1. Ninguna de las 13 pantallas contiene `slate-`, `indigo-`, `amber-`, `rose-` ni un hex crudo; todo color sale de `--emp-*`.
2. Ningún `@heroicons` queda importado en los cinco módulos.
3. Ningún `Card` / `CardHeader` / `Table` / `Badge` / `PageHeader` / `Input` / `Switch` de `Components/UI` queda en uso en estos módulos (salvo `Can`, `ConfirmDialog`, `Pagination` si se reusa el patrón, `ImageLightbox`).
4. Bajo 1024px no hay tablas: solo tarjetas. Bajo 640px toda acción primaria vive en la barra fija inferior y ningún objetivo táctil baja de 44px.
5. Todos los campos numéricos con consecuencia en dinero muestran esa consecuencia en el mismo momento en que se escriben (monto del gasto, porcentajes del tramo, descuento por inasistencia).
6. El listado de gastos abre con el mes en curso y muestra su total sin que el usuario filtre nada.
7. El estado activo/inactivo de categorías y conceptos se cambia sin salir del listado.
8. La pantalla de parámetros dice, en la primera pantalla sin desplazar, qué tramo rige hoy y cuánto vale la hora ordinaria con él.
9. Un festivo trasladado dice de qué fecha se trasladó, en el calendario y en la lista.
10. En vista consolidada el usuario lee por qué no puede escribir.
11. Sin regresiones: los nombres de ruta, los permisos y los contratos de `useForm` existentes se conservan salvo donde este documento indica lo contrario.
