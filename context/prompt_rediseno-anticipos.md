# Rediseño del módulo Anticipos — especificación de implementación

Aplica al proyecto `ERP_CONFECCION` (Laravel + Inertia + React + TypeScript + Tailwind v4).

Objetivo: llevar **Anticipos** a la misma piel de Empleados, Producción y Operaciones (clases `emp-*` de `resources/css/module-ui.css`) y, sobre todo, **hacer visible el saldo pendiente**, que hoy el módulo esconde aunque el backend ya lo maneje.

Referencia de diseño: `Anticipos rediseño.dc.html` (listado, nuevo anticipo, ficha del anticipo).

---

## 0. Reglas heredadas (no negociables)

1. `import '../../../css/module-ui.css';` en cada página del módulo. Sin hojas nuevas.
2. Colores solo por variable `--emp-*` (`bg`, `surface`, `field`, `border`, `row`, `text`, `muted`, `subtle`, `faint`, `accent`, `accent-on`, `accent-line`, `accent-fill`, `accent-tint`, `row-hover`, `danger`, `ok`). Cero `slate-*` / `indigo-*` / hex crudo.
3. Pesos 400 y 500 únicamente; jerarquía por tamaño y espacio.
4. Primarios delineados (`emp-btn emp-btn-primary`), nunca rellenos sólidos. **Esto elimina el botón violeta relleno «Nuevo anticipo» y el botón «Filtrar» actuales.**
5. Elevación = borde (`emp-card`), sin sombras apiladas.
6. Iconos **Phosphor** (`@phosphor-icons/react`), 13–17px. Se retiran los `@heroicons` del módulo.
7. Secciones de formulario con regla que se desvanece (`EmployeeFormSection`), no `Card` + `CardHeader`.
8. Foco temático, nunca el anillo del navegador.
9. Móvil: tarjetas en vez de tabla bajo `lg`, objetivos ≥44px, barra fija inferior con la acción primaria.
10. `Can`, `route()` y los nombres de ruta existentes se conservan.

---

## 1. El problema de fondo que resuelve este rediseño

`Advance` tiene `amount` **y** `remaining_amount`. `PayrollCalculationService` aplica descuentos que pueden ser **parciales**: baja `remaining_amount` y deja `status = 'pendiente'` hasta que llega a 0, momento en que pasa a `'descontado'`.

La pantalla actual muestra solo `amount` y el `status` crudo en minúsculas. Consecuencias que se corrigen:

| Hoy | Después |
| --- | --- |
| No se sabe cuánto queda por descontar | Columna **Saldo por descontar** con barra de avance |
| Dos estados (`pendiente` / `descontado`) | Tres: **Pendiente** (nada aplicado), **Parcial** (algo aplicado, queda saldo), **Descontado** |
| «Solo se pueden eliminar anticipos pendientes» — falso: el controlador compara `remaining_amount` con `amount` | El texto y la disponibilidad del botón siguen la regla real: **se puede eliminar solo si no tiene ningún descuento aplicado** |
| Hay que pulsar «Filtrar» | Los filtros aplican al cambiar |
| Sin totales | Saldo total por descontar, entregado del mes, descontado del año |
| No existe detalle | Ficha con el historial de aplicaciones por nómina |

**Estado derivado (front, sin migración):**
```ts
type AdvanceState = 'pendiente' | 'parcial' | 'descontado';

function advanceState(a: Advance): AdvanceState {
    if (a.status === 'descontado' || Number(a.remaining_amount) === 0) return 'descontado';
    return Number(a.remaining_amount) < Number(a.amount) ? 'parcial' : 'pendiente';
}
```

---

## 2. Archivos

### Nuevos
| Archivo | Qué es |
| --- | --- |
| `resources/js/Components/Advances/AdvanceFilterBar.tsx` | Buscador + segmentado de saldo + selector de empleado + contador |
| `resources/js/Components/Advances/AdvanceMonthGroup.tsx` | Grupo de mes con su cabecera de totales y su tabla |
| `resources/js/Components/Advances/AdvanceRow.tsx` | Fila de escritorio (incluye la celda de saldo con barra) |
| `resources/js/Components/Advances/AdvanceCard.tsx` | Tarjeta para móvil |
| `resources/js/Components/Advances/AdvanceBalanceCell.tsx` | Saldo + `% cubierto` + barra de 3px |
| `resources/js/Components/Advances/AdvanceStatePill.tsx` | Pastilla de los tres estados |
| `resources/js/Components/Advances/AdvanceImpactCard.tsx` | Panel «Efecto en la próxima nómina» del formulario |
| `resources/js/Pages/Advances/Show.tsx` | Ficha del anticipo |
| `resources/js/lib/advances.ts` | `advanceState`, `coveredPercent`, etiquetas |

### Reescritos
- `resources/js/Pages/Advances/Index.tsx`
- `resources/js/Pages/Advances/Create.tsx`

### Backend
- `app/Http/Controllers/AdvanceController.php` (métricas, búsqueda, filtro por saldo, `show`)
- `routes/web.php` (ruta `advances.show`)
- Reutilizar `PayrollAdvance` / la tabla pivote que ya escribe `PayrollCalculationService` para el historial de aplicaciones.

### No se toca
`module-ui.css` (ya tiene todo), `PayrollCalculationService` (la lógica de descuento no cambia), `StoreAdvanceRequest` salvo lo indicado en §6.

---

## 3. Listado — `Pages/Advances/Index.tsx`

### Props
```ts
interface Props {
    advances: PaginatedResponse<Advance & { employee: Employee; applied_amount: number }>;
    filters: { search: string; balance: 'with' | 'settled' | 'all'; employee_id: number | null };
    employees: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
    metrics: {
        pending_total: number; pending_count: number; pending_employees: number;
        month_total: number; prev_month_total: number;
        year_discounted: number; year_closed_count: number;
        next_payroll_date: string | null;
    };
}
```

### Estructura
1. **Contenedor**: `emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8`.
2. **Cabecera**: `h1` 24px «Anticipos»; descripción 13px: «Dinero entregado antes de la nómina. Lo que queda por descontar viaja al siguiente periodo.» A la derecha «Exportar» (`DownloadSimple`, `emp-btn emp-btn-sm`) y «Nuevo anticipo» (`emp-btn emp-btn-sm emp-btn-primary`, `Plus`), esta última oculta en móvil (vive en la barra inferior).
3. **Tres métricas** (`emp-card p-[17px]`, kicker `emp-kicker`, valor 27px `leading-none`):
   - **Saldo por descontar** — valor en `--emp-accent-on`; meta: «{pending_count} anticipos · {pending_employees} empleados · sale en la próxima nómina».
   - **Entregado en {mes}** — meta con el mes anterior.
   - **Descontado en el año** — meta «{year_closed_count} anticipos cerrados».
   En móvil, fila con scroll horizontal (`-mx-4 … overflow-x-auto px-4`).
4. **Barra de filtros** (`AdvanceFilterBar`), pegajosa en móvil (`sticky top-16 … sm:static`) — **desaparece el botón «Filtrar»**:
   - Buscador `emp-field pl-8` («Buscar empleado o motivo...»), debounce 300ms.
   - Segmentado `emp-seg` de 290px: **Con saldo | Descontados | Todos** (por defecto «Con saldo», que es la pregunta real del negocio; ojo: el default actual es `all`).
   - Select `emp-field w-[200px]` de empleado con `CaretDown` 13px.
   - Contador 12px a la derecha: «{total} anticipos · {pending_count} con saldo».
   - Cada cambio: `router.get(route('advances.index'), params, { preserveState: true, preserveScroll: true, replace: true })`.
5. **Agrupación por mes** (`AdvanceMonthGroup`), como los días de Producción: cabecera 11px uppercase «Agosto 2026» + meta 11px «2 anticipos · $ 477.440 entregados · $ 477.440 por descontar», y debajo su tabla. `gap-[22px]` entre grupos. El agrupado se calcula en el front sobre la página recibida (`date` ya viene ordenada desc).
6. **Tabla de escritorio** (`hidden lg:block`), sin caja, cabecera con `border-bottom: 1px solid var(--emp-border)`, celdas 11px uppercase `tracking-[0.09em]`:
   | Col | Ancho | Contenido |
   | --- | --- | --- |
   | Fecha | 96px | `formatDate(a.date)`, 13px `--emp-muted` |
   | Empleado | flexible | nombre 14px como `Link` a `advances.show`; debajo 11.5px `--emp-subtle` con documento y área |
   | Motivo | 190px | 13px `--emp-muted`, `line-clamp-1` |
   | Monto | 130px, derecha | `formatCurrency(a.amount)` |
   | Saldo por descontar | 210px | `AdvanceBalanceCell`: saldo 14px en `--emp-accent-on` (o «—» en `--emp-subtle` si está cerrado), «N% cubierto» 11px a la derecha, y barra de 3px (`--emp-accent` sobre `--emp-row`; gris `--emp-faint` cuando está cerrado) |
   | Estado | 120px | `AdvanceStatePill` |
   | acciones | 76px | icon-buttons 30px: `ArrowUpRight` (ver detalle) y `DotsThreeVertical` (menú: Ver detalle / Comprobante / Eliminar en `--emp-danger`, deshabilitado con tooltip si no se puede) |
7. **Pastillas de estado** (`AdvanceStatePill`): `Pendiente` → `emp-pill` neutra; `Parcial` → `emp-pill-accent` (borde+tinte acento, texto `--emp-accent-on`); `Descontado` → `emp-pill` neutra apagada. Siempre capitalizadas — nunca el valor crudo de la BD.
8. **Móvil** (`lg:hidden`): `AdvanceCard` — fecha + monto en la primera línea, nombre 14px, motivo 12px, barra de saldo y pastilla de estado, menú a la derecha.
9. **Paginación** como en Empleados: «Mostrando X–Y de Z» 12px + botones 30px con `emp-seg-on` en la activa.
10. **Vacío**: `emp-card p-6 text-center text-[13px]` con «No hay anticipos con este filtro.» + «Limpiar filtros» subrayado en `--emp-accent-on` si hay filtros activos.
11. **Barra fija inferior** en móvil con «Nuevo anticipo» dentro de `Can permission="advances.index.create"`.
12. **Eliminar**: `ConfirmDialog` con el mensaje correcto — «Se elimina el anticipo de {empleado} por {monto}. Solo es posible porque todavía no tiene descuentos aplicados.» El botón solo aparece si `Number(a.remaining_amount) === Number(a.amount)`.

---

## 4. Nuevo anticipo — `Pages/Advances/Create.tsx`

Se abandona el `Card` con grid de 2×2. Layout de tres columnas: índice 196px, formulario, panel 292px.

### Props añadidas
```ts
interface Props {
    employees: (Pick<Employee, 'id' | 'first_name' | 'last_name' | 'document_number'> & {
        pending_balance: number;   // suma de remaining_amount pendiente
        avg_net: number;           // neto promedio de los últimos 3 periodos pagados
        advances_this_year: number;
        avg_amount: number;
        last_advance: { date: string; amount: number } | null;
    })[];
    period: { start: string; end: string; payroll_date: string | null };
}
```

### Cabecera (pegajosa bajo el header de 64px)
Kicker «Anticipos · Nuevo», `h1` 20px «Nuevo anticipo», dos `emp-pill` de contexto («Se descuenta en la nómina del {payroll_date}», «Queda pendiente hasta cubrirse») y a la derecha «Cancelar» (`emp-btn-ghost`, `ArrowLeft`) + «Registrar anticipo» (`emp-btn-primary`, `Check`, `disabled` con `processing`).

### Secciones
```ts
export const ADVANCE_SECTIONS = [
    { id: 'quien',  label: 'A quién' },
    { id: 'cuanto', label: 'Cuánto y cuándo' },
    { id: 'motivo', label: 'Motivo' },
];
```
1. **A quién** (paso 1, Obligatorio): select `emp-field` de 420px con `Nombre · CC documento`; `emp-help`: «Solo empleados activos. El anticipo se descuenta de su nómina, no de la caja general.» Al elegir empleado se rellena el panel derecho.
2. **Cuánto y cuándo** (paso 2, Obligatorio), grid `sm:grid-cols-2`:
   - `Monto` con prefijo `$` + **tres chips de montos frecuentes** (`$ 100.000`, `$ 200.000`, `$ 300.000`) bajo el campo, 26px de alto, `emp-pill` clicable.
   - `Fecha de entrega` (`type="date"`, `color-scheme: dark`), `emp-help` con el periodo en que cae: «Cae en el periodo del {start} al {end}.»
   - Debajo, **`emp-note` viva** que se recalcula al teclear: «{monto} se suman al saldo de {saldo}. En la próxima nómina se descuentan {total} y el neto queda en {neto}.» Sin monto: «Escribe el monto y aquí ves cuánto le queda de neto al empleado en la próxima nómina.»
   - **Si el descuento supera el 40% del neto promedio**, la nota cambia a tono de peligro (borde y fondo desde `--emp-danger`) y el texto pasa a «… dejan un neto de {neto}: el {share}% del pago. Considera partirlo en dos periodos.» Es un **aviso, no un bloqueo**.
3. **Motivo** (paso 3, Obligatorio): cuatro chips (`Salud`, `Imprevisto familiar`, `Servicios públicos`, `Educación`) que escriben el textarea, textarea `emp-field` de 3 filas y `emp-help`: «Queda en el recibo de nómina del empleado.»

### Panel derecho
1. **Efecto en la próxima nómina** (`AdvanceImpactCard`): subtítulo con empleado y periodo; filas «Saldo que ya tenía», «Este anticipo», «Total a descontar» (esta última en `--emp-accent-on`); regla; kicker «Neto estimado del periodo» con valor 27px (en `--emp-danger` si el descuento pasa del 40%); meta «Sobre un promedio de {avg_net} en los últimos 3 periodos»; barra de 6px con la parte del neto que se lleva el descuento y su leyenda.
2. **Historial del empleado**: anticipos este año, promedio solicitado, último (fecha + monto).

Ambas tarjetas quedan vacías con «—» hasta que se elige empleado.

### Móvil
Índice oculto, panel al final del flujo, barra fija inferior con «Cancelar» + «Registrar anticipo» a 48px.

---

## 5. Ficha — `Pages/Advances/Show.tsx` (nueva)

Ruta `GET /advances/{advance}` → `advances.show`, permiso `advances.index.view`.

Props: `advance` (con `employee`), `applications` (nómina, fecha de pago, monto aplicado, saldo después), `employee_other` (otros anticipos del empleado), `employee_pending_total`, `can_delete: bool`.

Estructura:
1. Enlace de vuelta (kicker con `ArrowLeft`, «Anticipos»), `h1` 24px «Anticipo del {fecha}», y una línea con el empleado como enlace a su ficha, su documento, la pastilla de estado y la pastilla del motivo.
2. Acciones: «Comprobante» (`Printer`) y «Eliminar» (borde y texto `--emp-danger`), esta última solo si `can_delete`.
3. Cuatro `emp-card`: Monto entregado, Ya descontado (`amount - remaining_amount`), **Saldo por descontar** (en `--emp-accent-on`), Entregado hace N días.
4. **Cómo se ha descontado**: encabezado con «{pct}% cubierto», regla que se desvanece, barra de 6px, y tabla `Nómina / Pagada / Aplicado / Saldo después` con una fila por aplicación. Cierra con `emp-note`: «Los {saldo} restantes se descuentan solos en la próxima nómina. Puedes bajar el monto a aplicar al cerrar el periodo si el neto queda muy corto.» (coherente con lo que ya permite `Payrolls/Show`).
   - Si no hay aplicaciones: `emp-card p-6 text-center` con «Todavía no se ha descontado nada.»
5. **Panel derecho**: «Registro» (motivo, registrado por + fecha, y la línea **«Se puede eliminar»** con la razón real: «No: ya tiene descuentos aplicados») y «Otros anticipos de {nombre}» con el saldo total del empleado al pie.
6. En móvil, la tabla de aplicaciones pasa a lista de tarjetas.

---

## 6. Backend

### `AdvanceController@index`
```php
$search   = trim((string) $request->input('search', ''));
$balance  = $request->input('balance', 'with');   // with | settled | all   (antes: status=all)
$employeeId = $request->input('employee_id');

$query = Advance::query()->with('employee:id,first_name,last_name,document_number');

if ($search !== '') {
    $query->where(function ($q) use ($search) {
        $q->where('reason', 'like', "%{$search}%")
          ->orWhereHas('employee', fn ($e) => $e
              ->where('first_name', 'like', "%{$search}%")
              ->orWhere('last_name', 'like', "%{$search}%")
              ->orWhere('document_number', 'like', "%{$search}%"));
    });
}

if ($balance === 'with')    { $query->where('remaining_amount', '>', 0); }
if ($balance === 'settled') { $query->where('remaining_amount', '<=', 0); }

if ($employeeId) { $query->where('employee_id', $employeeId); }

$advances = $query->orderByDesc('date')->orderByDesc('id')->paginate(15)->withQueryString();
```
Métricas (sobre toda la empresa, no la página):
```php
'metrics' => [
    'pending_total'     => (float) Advance::where('remaining_amount', '>', 0)->sum('remaining_amount'),
    'pending_count'     => Advance::where('remaining_amount', '>', 0)->count(),
    'pending_employees' => Advance::where('remaining_amount', '>', 0)->distinct('employee_id')->count('employee_id'),
    'month_total'       => (float) Advance::whereBetween('date', [$monthStart, $monthEnd])->sum('amount'),
    'prev_month_total'  => (float) Advance::whereBetween('date', [$prevStart, $prevEnd])->sum('amount'),
    'year_discounted'   => (float) Advance::whereYear('date', now()->year)->where('remaining_amount', '<=', 0)->sum('amount'),
    'year_closed_count' => Advance::whereYear('date', now()->year)->where('remaining_amount', '<=', 0)->count(),
    'next_payroll_date' => $nextPayrollDate,
],
```
Nota: filtrar por `remaining_amount` en vez de por `status` es lo que hace posible el estado **Parcial** sin migración. Mantener `filters.balance` en la respuesta para que el segmentado no se desincronice.

### `AdvanceController@create`
Añadir a cada empleado del select: `pending_balance` (suma de `remaining_amount` pendiente), `avg_net` (neto promedio de los últimos 3 periodos pagados del empleado), `advances_this_year`, `avg_amount` y `last_advance`. Devolver también `period` (inicio/fin del periodo vigente y fecha estimada de pago) desde el mismo servicio que ya usa Nómina — no recalcularlo aquí.

### `AdvanceController@show` (nuevo)
```php
public function show(Advance $advance): Response
{
    $advance->load('employee:id,first_name,last_name,document_number', 'creator:id,name');

    return Inertia::render('Advances/Show', [
        'advance' => $advance,
        'applications' => /* filas de la pivote payroll_advance: payroll (nombre + periodo), paid_at, applied_amount, saldo posterior */,
        'employee_other' => Advance::where('employee_id', $advance->employee_id)
            ->whereKeyNot($advance->id)->orderByDesc('date')->limit(5)
            ->get(['id', 'date', 'amount', 'remaining_amount', 'reason']),
        'employee_pending_total' => (float) Advance::where('employee_id', $advance->employee_id)
            ->where('remaining_amount', '>', 0)->sum('remaining_amount'),
        'can_delete' => bccomp((string) $advance->remaining_amount, (string) $advance->amount, 2) === 0,
    ]);
}
```
El «saldo después» de cada aplicación se calcula acumulando desde `amount` en orden cronológico; si la pivote no guarda el saldo posterior, derivarlo así en el controlador (no en el front).

### Rutas
| Verbo | URI | Nombre |
| --- | --- | --- |
| GET | `/advances/{advance}` | `advances.show` |

Registrar la página `advances.index.view` donde se declaran los permisos del módulo. `destroy` no cambia: su regla ya es la correcta y ahora la UI la refleja.

---

## 7. Aceptación

- [ ] Cero `slate-*` / `indigo-*` / hex crudo en `Pages/Advances/**` y `Components/Advances/**`.
- [ ] `module-ui.css` importado en las tres páginas; ninguna hoja nueva.
- [ ] No queda ningún botón de relleno sólido: «Nuevo anticipo» y «Registrar anticipo» son delineados, y el botón «Filtrar» ya no existe.
- [ ] Los filtros aplican al cambiar, con debounce en el buscador, y sobreviven a la paginación.
- [ ] El listado agrupa por mes con totales por grupo.
- [ ] Cada fila muestra saldo por descontar, porcentaje cubierto y barra; los cerrados muestran «—» y barra gris.
- [ ] Los tres estados se ven correctamente: Pendiente / Parcial / Descontado, capitalizados.
- [ ] El botón de eliminar solo aparece cuando `remaining_amount === amount`, y el diálogo dice el motivo real.
- [ ] El formulario recalcula la nota y el panel al teclear el monto o cambiar de empleado, y avisa (sin bloquear) cuando el descuento pasa del 40% del neto.
- [ ] Los chips de monto y de motivo rellenan sus campos.
- [ ] La ficha lista las aplicaciones por nómina y cuadra: monto = ya descontado + saldo.
- [ ] Móvil (≤640px): tarjetas, objetivos ≥44px, barra fija inferior, sin scroll horizontal.
- [ ] Sin anillo de foco azul; `:focus-visible` en acento.
- [ ] Iconos: solo Phosphor.
