# Rediseño del módulo Nómina (escritorio y móvil) — especificación de implementación

Aplica al proyecto `ERP_CONFECCION` (Laravel + Inertia + React + TypeScript + Tailwind v4).

Objetivo: llevar **Nómina** a la misma piel de Empleados, Producción, Anticipos y Festivos (clases `emp-*` de `resources/css/module-ui.css`) y, sobre todo, **hacer del flujo `borrador → calculado → aprobado → pagado` el eje de la interfaz**: en cada pantalla debe verse en qué paso está el periodo y cuál es la acción siguiente.

Referencia de diseño: `Nomina.dc.html` (10 marcos: `1a/1b` listado, `2a/2b` detalle de la nómina, `3a/3b` nueva nómina, `4a/4b` empleado dentro de la nómina, `5a/5b` comprobante).

---

## 0. Reglas heredadas (no negociables)

1. `import '../../../css/module-ui.css';` en cada página del módulo. Sin hojas nuevas.
2. Colores solo por variable `--emp-*` (`bg`, `surface`, `field`, `field-alt`, `bar`, `border`, `row`, `text`, `muted`, `subtle`, `faint`, `accent`, `accent-on`, `accent-line`, `accent-fill`, `accent-tint`, `row-hover`, `danger`, `ok`). Cero `slate-*` / `indigo-*` / `amber-*` / `rose-*` / hex crudo dentro del módulo.
3. Pesos 400 y 500 únicamente; la jerarquía es tamaño y espacio.
4. Primarios delineados (`emp-btn emp-btn-primary`), nunca rellenos sólidos. **Esto elimina los `Button` variant `primary`/`success` rellenos de `Payrolls/Index.tsx` y `Payrolls/Show.tsx`.**
5. Elevación = borde (`emp-card`), sin sombras apiladas ni `StatCard` de colores.
6. Iconos **Phosphor** (`@phosphor-icons/react`), 13–17 px. Se retiran los `@heroicons` del módulo.
7. Segmentado (`emp-seg`) en vez de desplegables de pocas opciones; los filtros aplican al cambiar. **Desaparece el botón «Filtrar».**
8. Foco temático (`:focus-visible` de `module-ui.css`), nunca el anillo del navegador.
9. Móvil: tarjetas en vez de tabla bajo `lg`, objetivos ≥ 44 px (48 px en botones), campos a 16 px para que iOS no amplíe, barra fija inferior con la acción primaria del estado.
10. `Can`, `usePermissions`, `route()` y los nombres de ruta existentes se conservan: `payrolls.index`, `payrolls.create`, `payrolls.store`, `payrolls.show`, `payrolls.calculate`, `payrolls.approve`, `payrolls.pay`, `payrolls.export`, `payrolls.destroy`, `payrolls.payroll-employees.adjustments.{store,update,destroy}`.

---

## 1. El problema de fondo que resuelve este rediseño

| Hoy | Después |
| --- | --- |
| El estado es una `Badge` en minúsculas; hay que deducir qué sigue | Barra de 4 pasos + etiqueta «Paso 2 de 4 · falta aprobar» + botón de la acción siguiente, en listado y detalle |
| El detalle es una tabla de 11 columnas con filas expandibles que apilan 4 bloques dentro de un `colSpan` | **Maestro-detalle**: lista de empleados a la izquierda, panel fijo del empleado seleccionado a la derecha (patrón de Festivos) |
| Siete `StatCard` de colores en escritorio y un resumen distinto en móvil | Una franja única de totales (producido, jornada, legal, ajustes, deducciones, anticipos) + neto destacado, igual en ambos |
| Jornadas, anticipos, conceptos y días sin marcación viven dentro de la fila expandida y obligan a scroll horizontal | Viven en el panel lateral y, cuando se necesita todo, en la **ficha del empleado** (`payrolls.payroll-employees.show`) |
| En móvil el detalle es un acordeón con tablas dentro | Tarjetas con inputs a 44 px; el mismo estado `sessionEdits`/`absenceEdits`/`advanceEdits` alimenta ambas vistas (no duplicar lógica) |
| El listado no agrupa ni resume | Agrupado por mes con cabecera de totales, tres métricas arriba y filtros pegajosos |
| El formulario de creación no sugiere el periodo | Sugerencia calculada desde el último cierre + periodicidad segmentada |
| El comprobante solo existe en modo «detallado» de todo el periodo | Comprobante individual por empleado, misma retícula de impresión (`Payrolls/Print.tsx`) |

Sin migraciones: todo lo que se muestra ya lo entrega `PayrollController@show` (`payrollEmployeeTotals`, `workSessionsByEmployee`, `productionsByEmployee`, `payrollConcepts`) o se deriva en el front.

**Derivados del flujo (front, `resources/js/lib/payrolls.ts` nuevo):**
```ts
export const PAYROLL_FLOW = ['borrador', 'calculado', 'aprobado', 'pagado'] as const;
export type PayrollStatus = (typeof PAYROLL_FLOW)[number];

export const flowStep = (s: PayrollStatus) => PAYROLL_FLOW.indexOf(s);          // 0..3
export const isClosed = (s: PayrollStatus) => s === 'aprobado' || s === 'pagado';

/** Acción siguiente: etiqueta, icono, permiso y ruta POST. Una sola fuente para listado, detalle y móvil. */
export function nextAction(s: PayrollStatus) {
    switch (s) {
        case 'borrador':  return { label: 'Calcular',       icon: 'Calculator',  permission: 'payrolls.show.calculate', action: 'calculate' as const, hint: 'Procesa producción, jornadas y recargos del periodo.' };
        case 'calculado': return { label: 'Aprobar',        icon: 'CheckCircle', permission: 'payrolls.show.approve',   action: 'approve'   as const, hint: 'Aprobar cierra los ajustes de jornada y los conceptos manuales.' };
        case 'aprobado':  return { label: 'Marcar pagada',  icon: 'Money',       permission: 'payrolls.show.pay',       action: 'pay'       as const, hint: 'Descuenta los anticipos y habilita los comprobantes.' };
        default:          return { label: 'Comprobantes',   icon: 'Printer',     permission: 'payrolls.show.view',      action: 'export'    as const, hint: 'Periodo cerrado.' };
    }
}

export const stepLabel = (s: PayrollStatus) =>
    s === 'pagado' ? 'Cerrada' : `Paso ${flowStep(s) + 1} de 4 · ${
        s === 'borrador' ? 'sin calcular' : s === 'calculado' ? 'falta aprobar' : 'falta marcar pagada'}`;

export const modeLabel = (m?: string) =>
    m === 'fixed_daily' ? 'Salario diario' : m === 'hourly_legal' ? 'Por horas (legal)' : 'Por operaciones';
```

---

## 2. Archivos

### Nuevos
| Archivo | Qué es |
| --- | --- |
| `resources/js/lib/payrolls.ts` | `PAYROLL_FLOW`, `flowStep`, `nextAction`, `stepLabel`, `modeLabel`, `isClosed` |
| `resources/js/Components/Payrolls/PayrollFlowBar.tsx` | Barra de 4 tramos (3 px en tabla, 4 px en tarjeta) + etiqueta del paso. Verde `--emp-ok` solo cuando `pagado`; el resto en `--emp-accent-line`, vacíos en `--emp-row` |
| `resources/js/Components/Payrolls/PayrollFlowHeader.tsx` | Cabecera del detalle: barra + 4 rótulos con fecha/autor + texto «Acción siguiente» + botones (`Recalcular`, acción del estado) |
| `resources/js/Components/Payrolls/PayrollFilterBar.tsx` | Buscador (debounce 300 ms) + segmentado **Abiertas / Cerradas / Todas** + select de año + select de periodicidad + contador |
| `resources/js/Components/Payrolls/PayrollMonthGroup.tsx` | Grupo de mes con cabecera de totales (mismo patrón que `AdvanceMonthGroup`) |
| `resources/js/Components/Payrolls/PayrollRow.tsx` | Fila de escritorio del listado (incluye `PayrollFlowBar` y la acción del estado) |
| `resources/js/Components/Payrolls/PayrollCard.tsx` | Tarjeta de listado en móvil |
| `resources/js/Components/Payrolls/PayrollTotalsStrip.tsx` | Franja de totales del periodo + neto |
| `resources/js/Components/Payrolls/PayrollEmployeeList.tsx` | Lista maestra de empleados (escritorio) con búsqueda y segmentado de modalidad |
| `resources/js/Components/Payrolls/PayrollEmployeePanel.tsx` | Panel lateral del empleado seleccionado |
| `resources/js/Components/Payrolls/PayrollEmployeeSheet.tsx` | Versión móvil del panel (acordeón dentro de la tarjeta) |
| `resources/js/Components/Payrolls/SessionAdjustTable.tsx` | Jornadas con `Ajuste min.` + `Motivo` (tabla en `lg`, tarjetas debajo) |
| `resources/js/Components/Payrolls/LegalBreakdownPanel.tsx` | Recargos y horas extra (ley) + detalle por día + alerta de tope |
| `resources/js/Components/Payrolls/AdvanceDiscountList.tsx` | Anticipos a descontar con monto editable |
| `resources/js/Components/Payrolls/ManualConceptsPanel.tsx` | Conceptos manuales (listar, agregar, editar, eliminar) |
| `resources/js/Components/Payrolls/AbsenceList.tsx` | Días sin marcación con casilla + motivo |
| `resources/js/Pages/Payrolls/Employee.tsx` | Ficha completa del empleado dentro de la nómina |
| `resources/js/Pages/Payrolls/Receipt.tsx` | Comprobante individual imprimible |

### Reescritos
- `resources/js/Pages/Payrolls/Index.tsx`
- `resources/js/Pages/Payrolls/Show.tsx` (queda como orquestador: estado compartido + composición; ~250 líneas, no 1.661)
- `resources/js/Pages/Payrolls/Create.tsx`

### Backend
- `app/Http/Controllers/PayrollController.php`: métricas del listado, búsqueda y filtro por estado abierto/cerrado y periodicidad; `employee()` (ficha) y `receipt()` (comprobante individual); periodo sugerido en `create()`.
- `routes/web.php`: `payrolls.payroll-employees.show` y `payrolls.payroll-employees.receipt`.
- Permisos: reutilizar `payrolls.show.view`, `payrolls.show.edit_time`, `payrolls.show.manage_adjustments`, `payrolls.show.calculate|approve|pay`, `payrolls.index.create|delete`. No se crean permisos nuevos.

### No se toca
`module-ui.css` (ya tiene todo), `PayrollCalculationService` (el cálculo no cambia), `Payrolls/Print.tsx` (el informe general/detallado se conserva; el comprobante individual reutiliza sus estilos `pd-*`).

---

## 3. Listado — `Pages/Payrolls/Index.tsx` (marcos `1a` / `1b`)

### Props
```ts
interface Props {
    payrolls: PaginatedResponse<Payroll & { payroll_employees_count: number; company?: { name: string } }>;
    filters: { search: string; state: 'open' | 'closed' | 'all'; year: number; type: string | null };
    metrics: {
        open_net: number; open_employees: number; open_status: PayrollStatus | null; open_period_end: string | null;
        year_paid: number; year_closed_count: number; year_approved_unpaid: number;
        average_per_employee: number;
    };
}
```

### Estructura
1. **Contenedor**: `emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8`.
2. **Cabecera**: `h1` 24 px «Nómina»; descripción 13 px `--emp-muted`: «Periodos de liquidación de la empresa. Producido, jornada, recargos, anticipos y conceptos manuales se cierran aquí.» A la derecha «Exportar» (`DownloadSimple`, `emp-btn emp-btn-sm`) y «Nueva nómina» (`emp-btn emp-btn-sm emp-btn-primary`, `Plus`), oculta en móvil (vive en la barra inferior).
3. **Tres métricas** (`emp-card p-[17px]`, kicker `emp-kicker`, valor 27 px `leading-none`, meta 11 px `--emp-subtle`):
   - **Neto del periodo abierto** — valor en `--emp-accent-on`; meta «{open_employees} empleados · {open_status} · cierra el {open_period_end}». Sin periodo abierto: «Sin nómina abierta todavía».
   - **Pagado en {año}** — meta «{year_closed_count} nóminas cerradas · {year_approved_unpaid} aprobada(s) sin pagar».
   - **Promedio por empleado** — meta «Periodo abierto · {periodicidad}».
   En móvil, fila con scroll horizontal (`-mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3`).
4. **Barra de filtros** (`PayrollFilterBar`), pegajosa en móvil (`sticky top-16 z-10 … sm:static`), con `border-bottom: 1px solid var(--emp-border)`:
   - Buscador `emp-field pl-8` («Buscar nómina o periodo...»), debounce 300 ms.
   - Segmentado `emp-seg` 290 px: **Abiertas | Cerradas | Todas** (por defecto «Abiertas»).
   - Select de año `emp-field w-[120px]` y de periodicidad `emp-field w-[150px]`, ambos con `CaretDown` 13 px; ocultos bajo `sm` (en móvil solo buscador + segmentado).
   - Contador 12 px a la derecha: «{total} nóminas · {abiertas} abiertas».
   - Cada cambio: `router.get(route('payrolls.index'), params, { preserveState: true, preserveScroll: true, replace: true })`.
5. **Agrupación por mes** (`PayrollMonthGroup`, `gap-[22px]`), calculada en el front sobre `period_start` de la página recibida: cabecera 11 px uppercase `tracking-[0.09em]` «Agosto 2026» + meta 11 px «· 2 nóminas · $13.911.377 liquidados · 1 pendiente de pago».
6. **Tabla de escritorio** (`hidden lg:block`), sin caja, cabecera 11 px uppercase con `border-bottom: 1px solid var(--emp-border)`; rejilla compartida por cabecera y filas:
   ```ts
   export const PAYROLL_GRID = '150px minmax(0,1fr) 90px 168px 132px 104px 138px';
   ```
   | Col | Contenido |
   | --- | --- |
   | Periodo | «16/08 – 31/08», 13 px `--emp-muted` |
   | Nómina | nombre 14 px `Link` a `payrolls.show`; debajo 11.5 px `--emp-subtle` «quincenal · calculada hace 2 horas por {autor}»; si `isConsolidatedView`, tercera línea con la empresa en `--emp-faint` |
   | Empleados | 13 px derecha; «—» en borrador |
   | Flujo | `PayrollFlowBar` (4 tramos de 3 px, `gap-[5px]`) + `stepLabel()` 11 px; en el paso actual el texto va en `--emp-accent-on` |
   | Neto | 14 px derecha; `--emp-faint` cuando es `$0` |
   | Estado | `emp-pill` neutra en borrador, `emp-pill-accent` en calculado/aprobado, borde+texto `--emp-ok` en pagado |
   | Acciones | botón `emp-btn emp-btn-sm emp-btn-primary` con `nextAction()` + menú `DotsThreeVertical` |
   Fila: `emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5`. La nómina abierta más reciente lleva `background: var(--emp-row-hover); box-shadow: inset 2px 0 0 var(--emp-accent-line)`.
7. **Menú de fila** (mismo patrón que `AdvanceActionsMenu`): «Ver detalle», «Imprimir general», «Imprimir detallado» y, con `payrolls.index.delete`, «Eliminar» — o «Eliminar y revertir» en cerradas, **solo para super admin**, conservando el texto de advertencia actual del `ConfirmDialog`.
8. **Paginación**: «Mostrando 1–5 de 5» 12 px + chips de 30 px con borde `--emp-border`, activo `emp-seg-on`.
9. **Barra inferior móvil** (`fixed inset-x-0 bottom-0 z-30`, `background: var(--emp-bar)`, `border-top`): «Nueva nómina» `emp-btn emp-btn-primary w-full`.

### Tarjeta móvil (`PayrollCard`)
`emp-card p-[14px]`: fecha del periodo 11 px → nombre 15 px → «quincenal · 8 empleados» 12 px; a la derecha pastilla de estado + menú. Debajo `PayrollFlowBar` de 4 px y `stepLabel()`. Pie con `border-top: 1px solid var(--emp-row)`: kicker «Neto» + valor 22 px (`--emp-accent-on` si está abierta) y botón de la acción siguiente a 48 px. Las cerradas van con `emp-row-off` (opacidad 0.62) y acción «Comprobantes».

---

## 4. Detalle de la nómina — `Pages/Payrolls/Show.tsx` (marcos `2a` / `2b`)

`Show.tsx` conserva **todo el estado compartido actual** (`sessionEdits`, `absenceEdits`, `advanceEdits`, `expanded`) y sus constructores de payload (`buildAdjustments`, `buildAbsenceConfirmations`, `buildAdvanceAdjustments`); solo cambia la presentación. La vista móvil y la de escritorio escriben en el mismo estado con las mismas claves (`employeeId:sessionId`, `employeeId:workDate`, `employeeId:advanceId`).

1. **Migas** 12 px: `Nómina › {nombre}`.
2. **Cabecera**: `h1` 24 px + pastilla de estado en línea; meta 13 px «16/08/2026 – 31/08/2026 · quincenal · 8 empleados · calculada hace 2 horas por {autor}». A la derecha «Imprimir general» e «Imprimir detallado» (`emp-btn emp-btn-sm`).
3. **`PayrollFlowHeader`** (`emp-card p-[16px_18px]`, `mt-4`) — **es la pieza protagonista**:
   - Barra de 4 tramos de 4 px (`grid-cols-4 gap-1.5`).
   - Debajo, 4 rótulos alineados a cada tramo: título 12 px (el actual en `--emp-accent-on`, los futuros en `--emp-subtle`) y meta 11 px («creada 16/08», «hoy 09:41 · paso actual», «cierra ajustes», «genera comprobantes»).
   - Separador vertical de 1 px `--emp-border`; a su derecha kicker «Acción siguiente» y el `hint` de `nextAction()` en 12 px, máx. 34 caracteres de ancho.
   - Botones: «Recalcular» (`emp-btn`, visible en borrador y calculado, con `payrolls.show.calculate`) y el primario del estado (`emp-btn emp-btn-primary`, 38 px). Cada uno abre su `ConfirmDialog` con los textos actuales de `Show.tsx` (incluido el aviso de que se aplicarán los ajustes capturados).
4. **`PayrollTotalsStrip`** (`emp-card`, `grid-cols-[repeat(6,minmax(0,1fr))_200px] gap-[14px] p-[14px_18px]`): Producido · Jornada · Legal (horas) · Ajustes (`+`, `--emp-accent-on`) · Deducciones (`−`, `--emp-danger`) · Anticipos (`−`, `--emp-danger`); última celda con `border-left` y el **Neto a pagar** en 26 px `--emp-accent-on` + «bruto {total}» 11 px. Las columnas Jornada y Legal se ocultan según `show_daily_column` / `show_legal_column`, como hoy.
5. **Maestro-detalle** (`mt-5 flex items-start gap-[26px]`):
   - **Izquierda** (`min-w-0 flex-1`, `PayrollEmployeeList`): buscador `emp-field` + segmentado `emp-seg` **Todos | Operaciones | Jornada | Horas (legal)** (filtro en cliente sobre la página, como hoy); cabecera 11 px y filas con rejilla `minmax(0,1fr) 118px 118px 22px`:
     nombre 14 px + línea 11.5 px «CC {documento} · {modalidad} · {1.284 unidades | 12 jornadas · 96,5 h}», pastilla `--emp-danger` «Tope excedido» junto al nombre cuando `overtime_limit_alerts.length > 0`; **Bruto** 13 px `--emp-muted`; **Neto** 14 px; `CaretRight`.
     Seleccionada: `background: var(--emp-row-hover); box-shadow: inset 2px 0 0 var(--emp-accent-line)`, neto en `--emp-accent-on`.
     Última fila fija de **Totales · N empleados** sobre `emp-strip`, con bruto y neto del periodo.
   - **Derecha** (`w-[400px] shrink-0 lg:sticky lg:top-[84px] lg:self-start`, `PayrollEmployeePanel`), en tarjetas `emp-card` apiladas con `gap-3`:
     a) **Identidad**: inicial 40 px sobre `--emp-accent-fill`, nombre 16 px, «CC … · cargo», pastillas de modalidad y de jornadas/horas. Aviso `emp-note` en `--emp-danger` cuando hay tope excedido, con el texto legal actual («requieren autorización previa del Ministerio del Trabajo»).
     b) **Liquidación**: filas 12.5 px (salario base, recargo nocturno, dominical/festivo, horas extra **o** producido/ajustes según modalidad), «Bruto devengado», deducciones y anticipo en `--emp-danger`; pie con **Neto a pagar** 24 px `--emp-accent-on` y enlace «Ver ficha completa» → `payrolls.payroll-employees.show`.
     c) **Anticipos a descontar** (`AdvanceDiscountList`) — solo si hay: motivo + fecha + saldo, input de monto 38 px alineado a la derecha, editable con `payrolls.show.manage_adjustments`; texto de ayuda «Si descuentas menos, el resto viaja al siguiente periodo».
     d) **Conceptos manuales** (`ManualConceptsPanel`): botón «Agregar» (`emp-btn emp-btn-sm emp-btn-primary`) habilitado solo con nómina `calculado` + permiso; si no hay conceptos activos, mantener el aviso con enlace a `payroll-concepts.index`.
     e) **Días sin marcación** (`AbsenceList`): casilla + fecha + importe en `--emp-danger` + input de motivo; en modalidad `fixed_daily` el bloque es informativo (sin casilla), como hoy.
   - Sin empleado seleccionado, el panel muestra `EmployeeAsideCard` con «Toca un empleado para ver su liquidación» (igual que Festivos).

### Móvil (`2b`)
Cabecera con `ArrowLeft` + nombre corto; pastilla de estado y meta; `PayrollFlowHeader` compacto (barra + `stepLabel` + hint + «Recalcular» a 48 px); tarjeta de **Resumen del periodo** con `dl` (Producido, Jornada y recargos, Ajustes, Deducciones, Anticipos) y pie con Neto 24 px; buscador 44 px + segmentado; **acordeón** de empleados (`PayrollEmployeeSheet`): cabecera con nombre, modalidad, neto y `CaretDown`; abierta con borde `--emp-accent` y cuerpo `--emp-field-alt` que contiene Liquidación, Jornadas (2 visibles + «Ver las N jornadas»), Anticipos, Conceptos y el enlace a la ficha completa. Barra inferior fija con la acción del estado a 48 px.

---

## 5. Empleado dentro de la nómina — `Pages/Payrolls/Employee.tsx` (marcos `4a` / `4b`)

Ruta nueva `payrolls.payroll-employees.show` (`GET /payrolls/{payroll}/empleados/{payrollEmployee}`), permiso `payrolls.show.view`.

1. Migas `Nómina › {periodo} › {empleado}`.
2. **Cabecera**: inicial 48 px, nombre 24 px, «CC … · cargo · ingreso {fecha}», pastillas: modalidad (`emp-pill-accent`), salario base, banco/cuenta, y tope excedido (`emp-pill-warn`). A la derecha «Anterior»/«Siguiente» empleado (`emp-btn emp-btn-sm`) y «Comprobante» (`emp-btn emp-btn-sm emp-btn-primary`).
3. **Franja de 5 celdas** (`emp-card`): Jornadas (días + horas/minutos), Ordinarias (con nocturnas), Extras (en `--emp-accent-on`, con nota en `--emp-danger` si superan el tope), Dom/festivo, Bruto devengado (+ neto).
4. **Columna izquierda**:
   - **Jornadas registradas** (`SessionAdjustTable`): rejilla `96px 92px 76px 76px 84px 116px minmax(0,1fr)` → Fecha, Estado, Entrada, Salida, Minutos, `Ajuste min.` (input 38 px), Motivo (input). Editables solo con nómina `calculado` + `payrolls.show.edit_time` y sesión `closed`/`adjusted` con `clock_out_at`. Las filas ya ajustadas llevan `background: var(--emp-row-hover)` y bordes de input en `--emp-accent`. Pie con total de minutos/horas y enlace «Ver las N jornadas».
   - **Recargos y horas extra (ley)** (`LegalBreakdownPanel`): 4 celdas (salario base periodo, recargo nocturno, dominical/festivo, horas extra) + línea 11 px «Valor/hora aplicado … · jornada semanal legal … h · divisor mensual …» tomada de `legal_parameters_snapshot`; debajo, detalle por día con rejilla `96px repeat(4,minmax(0,1fr)) 96px 104px`.
   - Para modalidad **por operaciones**, en lugar del bloque legal va **Producción del periodo** (fecha, referencia, operación, cantidad, valor, estado) con la nota actual sobre producciones confirmadas y pendientes.
5. **Columna derecha** (`w-[360px]`): Liquidación (Devengos / Descuentos / Neto 26 px), Conceptos manuales (con editar y eliminar por fila), Anticipos, Días sin marcación, y al final `Descartar` + `Guardar y recalcular` (`emp-btn emp-btn-primary`, POST a `payrolls.calculate` con los mismos payloads).
6. **Móvil**: mismas secciones apiladas en `emp-card`; inputs 44 px; barra inferior con botón icono «Descartar» 48×48 y «Guardar y recalcular» a 48 px.

---

## 6. Nueva nómina — `Pages/Payrolls/Create.tsx` (marcos `3a` / `3b`)

1. Migas `Nómina › Nueva`; `h1` 24 px + descripción «Se crea en borrador. El cálculo se hace después, cuando la producción y las jornadas del periodo ya están cerradas.»; acciones «Cancelar» y «Crear borrador» (`emp-btn emp-btn-primary`) arriba a la derecha en escritorio.
2. **Tarjeta del formulario** (`emp-card p-[20px_22px]`, `flex-1`):
   - Kicker «Datos del periodo».
   - **Sugerencia** en `emp-note`: «La última nómina cerró el {fecha}. Con periodicidad {tipo} el siguiente periodo va del {inicio} al {fin}.» + botón «Usar periodo sugerido» (`emp-btn emp-btn-sm emp-btn-primary`). El backend calcula `suggested = ['name','period_start','period_end','type']` en `create()` a partir de la última nómina de la empresa y de `PayrollPeriodicity`.
   - Campos (`emp-label` + `emp-field`, rejilla 2 columnas): **Nombre** (ancho completo, ayuda «Aparece en el listado, en los comprobantes y en el reporte de nómina»), **Fecha inicio**, **Fecha fin**, **Periodicidad** como `emp-seg` de las periodicidades activas (con ayuda que enlaza a `payroll-periodicities.index`), **Notas** (`textarea.emp-field`).
   - Validación: si `period_end < period_start`, error `emp-error` bajo el campo; si el rango se solapa con otra nómina de la empresa, aviso `emp-note` en `--emp-danger` («Ya existe {nombre} que cubre parte de este rango») antes de enviar.
3. **Aside 340 px**: «Qué pasa después» (4 pasos numerados con el texto de `nextAction`) y «Qué entra en el cálculo» (producción confirmada y pendiente, jornadas cerradas o ajustadas, festivos, anticipos con saldo, parámetros legales vigentes), con iconos Phosphor 15 px.
4. **Móvil**: cabecera con `X`, campos a 44 px, nota de sugerencia, resumen «Qué pasa después» en una tarjeta, barra inferior fija con «Crear borrador».

---

## 7. Comprobante individual — `Pages/Payrolls/Receipt.tsx` (marcos `5a` / `5b`)

Ruta nueva `payrolls.payroll-employees.receipt` (`GET /payrolls/{payroll}/empleados/{payrollEmployee}/comprobante`), permiso `payrolls.show.view`. **Reutiliza tal cual los estilos `pd-*` de `Payrolls/Print.tsx`** (carta, márgenes 12 mm, tinta `#111827`, acento `#c2410c`, `-webkit-print-color-adjust: exact`) y dispara `window.print()` a los 500 ms, igual que hoy.

Contenido de la hoja, en este orden:
1. Encabezado corporativo (logo/inicial, nombre, NIT, dirección, teléfono) y bloque derecho: kicker «Comprobante de pago», título «Liquidación de Nómina», nombre de la nómina en acento y «Periodo …».
2. Regla `pd-rule` de 2 px.
3. Bloque de empleado: nombre 22 px, documento (`pd-docnum`), modalidad (`pd-mod`) y cuenta bancaria; a la derecha caja `pd-stats` con **Jornadas** (días, minutos, horas) y **Bruto**.
4. `Jornadas registradas` — fecha, entrada, salida, minutos, horas, valor del día; `tfoot` con totales. Los domingos y festivos se marcan en acento. Si la modalidad es por operaciones, la sección es `Detalle de operaciones` (fecha, referencia, operación, cantidad, valor).
5. `Recargos y horas extra (ley)` — salario base, recargo nocturno, dominical/festivo, horas extra (solo en `hourly_legal`).
6. `Liquidación del periodo` en dos columnas `Devengos` / `Descuentos`, con «Anticipos entregados» en gris informativo y «Anticipo aplicado en este periodo» con signo negativo.
7. Barra negra `pd-net` con **Neto a pagar** y el periodo.
8. Notas `pd-note` cuando aplique: saldo de anticipos que se traslada y descuentos mayores al devengado (mismos textos que `Print.tsx`).
9. Firmas (responsable y empleado) y pie con empresa · NIT · periodo · paginación.
10. En pantalla, antes de imprimir, cabecera de la app con «Imprimir» y «Compartir PDF»; en móvil, tarjeta con el neto y una vista previa reducida de la hoja (`transform: scale(.4)`) más la barra inferior con esos dos botones a 48 px.

---

## 8. Móvil — reglas del módulo

- Nada de tablas bajo `lg`: tarjetas y acordeones.
- Botones 48 px (`emp-btn` ya lo hace bajo 640 px), casillas 20 px, campos 44 px con `font-size: 16px`.
- Barra inferior fija con la acción principal del contexto: «Nueva nómina» (listado), acción del estado (detalle), «Guardar y recalcular» (empleado), «Imprimir / Compartir PDF» (comprobante). Siempre con `padding-bottom: max(1rem, env(safe-area-inset-bottom))` y fondo `--emp-bar`.
- El contenido reserva `pb-28` para no quedar bajo la barra.
- Las métricas van en fila con scroll horizontal; nunca en rejilla apretada.
- Filtros pegajosos bajo la cabecera (`sticky top-16`).

---

## 9. Accesibilidad y detalles

- La barra de flujo es decorativa (`aria-hidden`); el estado se comunica con la pastilla y con `stepLabel()` en texto.
- Todo botón de icono lleva `aria-label` («Acciones de la nómina de agosto», «Ver detalle de …»).
- El color nunca es el único distintivo: pagado lleva texto «pagado» además del verde; el tope excedido lleva icono `Warning` además del rojo.
- Inputs de ajuste con `aria-label` que incluya la fecha de la jornada.
- `emp-hover-row` en filas; `:focus-visible` temático heredado de `module-ui.css`.

---

## 10. Criterios de aceptación

1. Ni un `slate-*`, `indigo-*`, `amber-*` o `rose-*` en `resources/js/Pages/Payrolls/**` ni en `resources/js/Components/Payrolls/**`; ni un `@heroicons` en el módulo.
2. `Show.tsx` baja de 1.661 líneas a un orquestador de ~250 líneas; los payloads enviados a `payrolls.calculate` son idénticos a los actuales (mismas claves `employee_adjustments`, `absence_confirmations`, `advance_adjustments`).
3. En cualquier ancho, el listado muestra para cada periodo: paso del flujo, neto y acción siguiente, sin abrir el detalle.
4. El detalle en escritorio no tiene scroll horizontal: la lista de empleados y el panel caben en 1.280 px de contenido.
5. Editar minutos, motivo, monto de anticipo o casilla de inasistencia produce el mismo resultado desde móvil y desde escritorio.
6. Las acciones de estado respetan permisos y estado: «Aprobar» solo en `calculado`, «Marcar pagada» solo en `aprobado`, «Eliminar y revertir» solo super admin en cerradas.
7. El comprobante individual imprime en una hoja carta sin cortes y con el neto visible.
8. Sin migraciones nuevas y sin cambios en `PayrollCalculationService`.
