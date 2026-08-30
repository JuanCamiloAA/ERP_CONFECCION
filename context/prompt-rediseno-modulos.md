# Prompt de implementación — Rediseño de Empresas, Mi empresa, Periodicidad de pagos y Planes de membresía

Pégale este documento completo a tu agente de código (Claude Code, Cursor, etc.) dentro del repo `ERP_CONFECCION`.
Es la especificación de los prototipos ya aprobados: `Rediseno - ERP (4 modulos).dc.html` (variantes A · Consola y B · Tablero).

---

## 0. Contexto del repo

Laravel + Inertia + React + TypeScript + Tailwind (modo claro/oscuro con `useDarkMode`).

Archivos que se tocan:

| Módulo | Página actual |
| --- | --- |
| Empresas | `resources/js/Pages/Companies/Index.tsx`, `Create.tsx`, `Edit.tsx` |
| Mi empresa | `resources/js/Pages/Settings/Index.tsx` |
| Periodicidad de pagos | `resources/js/Pages/PayrollPeriodicities/Index.tsx`, `Create.tsx`, `Edit.tsx` |
| Planes de membresía | `resources/js/Pages/SuperAdmin/MembershipPlans/Index.tsx`, `Create.tsx`, `Edit.tsx` |
| Primitivas | `resources/js/Components/UI/*` |
| Layout | `resources/js/Layouts/AppLayout.tsx` |

**Regla general:** no reescribir las primitivas existentes (`Button`, `Card`, `Badge`, `Table`, `Input`, `Select`, `Switch`, `PageHeader`). Se extienden y se añaden 6 componentes nuevos. Nada de librerías nuevas salvo `@dnd-kit/core` + `@dnd-kit/sortable` (solo si se implementa el arrastre; ver §5).

---

## 1. Lo primero: interruptor Tabla ⇄ Tarjetas en pantalla

Es el requisito central. Toda pantalla de listado (Empresas, Periodicidad, Planes) muestra un control segmentado en la barra de filtros que alterna entre **Tabla** (densa, para operar) y **Tarjetas** (para leer de un vistazo).

### 1.1 Componente nuevo: `resources/js/Components/UI/ViewToggle.tsx`

```tsx
import { Squares2X2Icon, TableCellsIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type ViewMode = 'table' | 'cards';

interface Props {
    value: ViewMode;
    onChange: (v: ViewMode) => void;
    className?: string;
}

export function ViewToggle({ value, onChange, className }: Props) {
    const opts: { v: ViewMode; label: string; Icon: typeof TableCellsIcon }[] = [
        { v: 'table', label: 'Tabla', Icon: TableCellsIcon },
        { v: 'cards', label: 'Tarjetas', Icon: Squares2X2Icon },
    ];
    return (
        <div
            role="group"
            aria-label="Cambiar vista"
            className={cn(
                'inline-flex items-center gap-0.5 rounded-lg border border-slate-300 p-0.5 dark:border-slate-700',
                className,
            )}
        >
            {opts.map(({ v, label, Icon }) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    aria-pressed={value === v}
                    title={label}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                        value === v
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50',
                    )}
                >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
}
```

### 1.2 Hook nuevo: `resources/js/hooks/useViewMode.ts`

Recuerda la elección por módulo (no global) en `localStorage`, y en móvil arranca en `cards`.

```ts
import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from '@/Components/UI/ViewToggle';

const KEY = (module: string) => `erp.viewMode.${module}`;

export function useViewMode(module: string, fallback: ViewMode = 'table') {
    const [mode, setMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return fallback;
        const saved = window.localStorage.getItem(KEY(module));
        if (saved === 'table' || saved === 'cards') return saved;
        return window.matchMedia('(max-width: 767px)').matches ? 'cards' : fallback;
    });

    useEffect(() => {
        window.localStorage.setItem(KEY(module), mode);
    }, [module, mode]);

    return [mode, useCallback((v: ViewMode) => setMode(v), [])] as const;
}
```

Reglas:
- Nunca borrar otras claves de `localStorage`.
- El toggle vive **a la derecha de la barra de filtros**, nunca en el `PageHeader`.
- La paginación, filtros y buscador son idénticos en ambas vistas: solo cambia la representación de las filas.
- En `< 768px` la vista tabla se renderiza igual que hoy (la clase `responsive-table` de `resources/css/app.css` ya la convierte en fichas); el toggle sigue visible.

---

## 2. Componentes nuevos compartidos

Crear en `resources/js/Components/UI/`:

### 2.1 `UsageBar.tsx`
Barra de 4px + etiqueta `usado / límite`. Usada en Empresas (staff), Editar empresa (staff y empleados) y Periodicidad (uso en nóminas).

```tsx
interface Props { used: number; limit: number | null; label?: string; className?: string }
```
- `limit === null` → texto `X / ∞`, barra al 100 % en tono neutro (`bg-slate-300 dark:bg-slate-600`).
- `pct >= 90` → barra `bg-rose-500`; `pct >= 75` → `bg-amber-500`; resto `bg-indigo-500`.
- Contenedor: `h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden`.
- Números con `tabular-nums`.

### 2.2 `StatBand.tsx`
Fila de 2–4 métricas: un solo bloque `rounded-xl border` con divisores verticales (`divide-x divide-slate-200 dark:divide-slate-700`), sin sombras ni tarjetas separadas.
```tsx
interface Stat { label: string; value: string; note?: string; tone?: 'default' | 'warning' }
interface Props { stats: Stat[] }
```
Tipografía: label `text-[10px] uppercase tracking-[0.1em] text-slate-500`, valor `text-2xl font-semibold tabular-nums`, nota `text-xs text-slate-500`.

### 2.3 `FilterChips.tsx`
Chips redondos que sustituyen los `<select>` sueltos de estado.
```tsx
interface Chip { key: string; label: string; count?: number }
interface Props { chips: Chip[]; active: string; onChange: (key: string) => void }
```
Activo: `border-indigo-500 bg-indigo-50 text-indigo-700` (dark: `bg-indigo-900/30 text-indigo-300`). Inactivo: `border-slate-300 text-slate-600`.

### 2.4 `EntityCard.tsx`
Tarjeta genérica para las vistas `cards`: cabecera (avatar/iniciales + título + subtítulo + `Badge` de estado), cuerpo con 2 métricas en grid, `UsageBar` opcional, pie con tag + acciones.
Grid contenedor recomendado: `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` — **usar `minmax(0,1fr)`** (`grid-cols-[repeat(auto-fit,minmax(280px,1fr))]`) para que las tarjetas se compriman en vez de desbordar.

### 2.5 `SideIndex.tsx`
Índice lateral pegajoso para Mi empresa.
```tsx
interface Item { id: string; label: string; meta?: string }
interface Props { items: Item[]; activeId: string }
```
- `<nav className="sticky top-6 hidden lg:flex flex-col">`, cada ítem con `border-l` (activo `border-indigo-500 text-slate-900`, inactivo `border-slate-200 text-slate-500`).
- El activo se calcula con `IntersectionObserver` sobre las `<section id>`; al hacer clic, `document.getElementById(id)?.focus()` + scroll manual con `window.scrollTo({ top, behavior: 'smooth' })`. **No usar `scrollIntoView`.**
- En `< lg` el índice se reemplaza por acordeones (ver §4.3).

### 2.6 `StickySaveBar.tsx`
Barra fija inferior para formularios largos (Mi empresa, Editar empresa):
`sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90`, con texto "N cambios sin guardar" + botón `Guardar cambios` (`loading={processing}`) + `Cancelar` ghost.

---

## 3. Empresas (`Pages/Companies/`)

### 3.1 Index
Orden vertical: `PageHeader` → `StatBand` → barra de filtros (buscador + `FilterChips` + `ViewToggle`) → contenido según vista → `Pagination`.

**PageHeader**: título `Empresas`, descripción con dato real: `{total} empresas · {activas} activas · {staffUsados}/{staffLimite} usuarios staff`. Acciones: `Exportar` (variant `outline`) + `Nueva empresa` (primary).
Los botones de acción llevan `whitespace-nowrap shrink-0` (hoy se parten en pantallas de 1280px).

**StatBand** (4 métricas, calculadas en el controlador y pasadas como prop `stats`):
1. Empresas activas — `4 / 5`, nota con la desactivada más reciente.
2. Empleados totales.
3. Usuarios staff — `33 / 40`, nota `N empresas al 90 % del límite`.
4. Membresías por vencer (≤ 45 días) — `tone: 'warning'` si > 0.

**FilterChips**: `Todas`, `Activas`, `Inactivas`, `Al límite de staff` (staff_users_count / max_staff_users ≥ 0.9), `Por vencer` (membership_ends_at ≤ hoy + 45 días). Cada chip lleva `count`. Los dos últimos son filtros nuevos: implementarlos en `CompanyController@index` como scopes y exponerlos en `filters`.

**Vista tabla** (columnas, en este orden): Empresa (logo/iniciales + nombre + `NIT · ciudad` + `Badge` estado) · Plan (`Badge` neutral) · Usuarios staff (`UsageBar`) · Empleados (derecha, `tabular-nums`) · Membresía (texto `Vence 31 dic 2026` / `Sin vencimiento` / `Venció ...` en rose) · Acciones (`Editar`, `Usuarios`, menú `…` con Desactivar).
Se eliminan las columnas separadas NIT, Contacto y Usuarios: NIT va bajo el nombre, contacto pasa al menú `…` y a la ficha de edición, y "Usuarios" queda cubierto por la barra de staff.

**Vista tarjetas**: `EntityCard` por empresa (iniciales, nombre, NIT, badge, Empleados y Staff como métricas, `UsageBar`, tag de plan + vencimiento, botones `Editar` / `Usuarios`). Debajo, opcional, una lista compacta "Todas las empresas" de una línea por empresa.

Empty state con `EmptyState` existente: "No se encontraron empresas" + botón limpiar filtros.

### 3.2 Edit / Create
Dos columnas (`lg:grid-cols-3`, formulario `lg:col-span-2`):
- **Datos de la empresa** — igual que hoy.
- **Uso del plan** (nueva `Card`): dos `UsageBar` (usuarios staff, empleados) + enlace `Ver los N usuarios de esta empresa`. Sustituye el bloque de texto gris actual.
- Columna derecha: **Membresía** como lista de radios seleccionables (nombre, precio, límites por plan) en vez de `<select>`, más fechas inicio/fin; **Logo**; **Estado** con `Switch`.
- Pie: `StickySaveBar`.

---

## 4. Mi empresa (`Pages/Settings/Index.tsx`)

Estructura `lg:grid-cols-[196px,1fr]`: `SideIndex` a la izquierda, secciones a la derecha, cada una con `id` y `<section>`:

1. `#datos` — nombre, NIT, correo, teléfono, dirección + logo (el logo deja de ser una `Card` aparte y entra aquí tras un divisor).
2. `#nomina` — moneda (`Select`) + periodicidad por defecto como `FilterChips` de una sola selección alimentado por `page.props.payrollPeriodicities`, con nota "Se administran en Periodicidad de pagos" enlazando a ese módulo.
3. `#deducciones` — tabla editable de 3 columnas (identificador, etiqueta, %) con cabecera fija y fila de totales: **suma de porcentajes** mostrada en el encabezado de la sección ("Suman 8,00 % del devengado"). Validar cliente-side que la suma ≤ 100.
4. `#dificultad` — barra escalonada de 5 tramos proporcional a los umbrales (colores: `indigo-900 → indigo-400` en dark / `indigo-200 → indigo-600` en claro) + una fila por grado con rango calculado (`de 1,20 a 2,50 min`) y su input. El grado 5 es de solo lectura ("más de X min"). Nota final: "Al guardar, ninguna referencia se recalcula: usa Reaplicar rangos en Referencias".
5. `#historial` (opcional, si existe auditoría) — últimos cambios.

Reglas:
- Mantener `canEdit` (`settings.index.edit`): todos los inputs `disabled` y sin `StickySaveBar` si es solo lectura, conservando el aviso ámbar actual.
- El contador de cambios de la barra de guardado se calcula comparando `data` con los props iniciales.
- Móvil: el `SideIndex` se sustituye por acordeones (`<details>` estilizado o estado local), uno por sección, y la `StickySaveBar` queda fija abajo.

---

## 5. Periodicidad de pagos (`Pages/PayrollPeriodicities/`)

`PageHeader` (título + "El orden define cómo aparecen en los selectores de nómina y en Mi empresa") → filtros (buscador + `FilterChips` Todos/Activos/Inactivos + `ViewToggle`) → contenido.

**Vista tabla**: columnas Arrastre (`ArrowsUpDownIcon`, `cursor-grab`) · Código (`font-mono text-indigo-600 dark:text-indigo-300`) · Nombre (+ descripción como subtítulo) · Uso en nóminas (`UsageBar` relativa al máximo de la lista + conteo) · Estado (`Switch` en línea que hace `router.patch` optimista) · Acciones.
Se elimina la columna "Orden" numérica: el orden es la posición de la fila.

**Vista tarjetas**: lista de tarjetas de una fila (arrastre, nombre + código, nóminas, `Switch`, `Editar`) y, a la derecha en `xl`, un panel **"Nueva periodicidad"** con nombre, código autogenerado (slug con `_`), switch "Activa al crear" y botón de creación — así crear no obliga a cambiar de pantalla.

**Reordenar**: `@dnd-kit/sortable`; al soltar, `router.post(route('payroll-periodicities.reorder'), { ids: [...] }, { preserveScroll: true })`. Añadir ruta + método `reorder` que reescribe `sort_order` en una transacción. Si no se quiere dependencia nueva, dejar los botones ↑/↓ por fila con la misma llamada.

**Create / Edit**: una sola `Card`, código derivado del nombre en vivo, `Switch` con descripción, `StickySaveBar`. Mostrar cuántas nóminas y empresas usan la periodicidad antes de permitir desactivar.

---

## 6. Planes de membresía (`Pages/SuperAdmin/MembershipPlans/`)

El toggle aquí cambia entre **Tabla** (administrar) y **Tarjetas** (comparar). Por defecto `cards`.

**Vista tarjetas**: grid `auto-fit minmax(280px,1fr)`; por plan: nombre + slug + `Badge` estado, precio grande (`$319.000` + `/ mes`), límites Staff / Empleados en grid de 2, lista de `features_json` con check indigo, pie con `N empresas` + `Editar plan`. El plan con más empresas asignadas se marca como destacado (borde indigo + `shadow-md`).

**Vista tabla**: la actual, más una columna **Empresas** clicable que enlaza a `companies.index?plan=slug`, y precio/límites con `tabular-nums`. Envolver en `overflow-x-auto` (ya lo hace `Table`).

**Create / Edit**: dos columnas — datos y límites a la izquierda (con textos de ayuda "vacío = ilimitado"), a la derecha una **previsualización en vivo** de la tarjeta del plan tal como la verá el super admin. Características una por línea (`features_text`), igual que hoy.

---

## 7. Consistencia visual (aplica a los cuatro módulos)

- Tipografía y color: los de Tailwind ya usados en el repo. No introducir paletas nuevas; el prototipo oscuro se traduce a `dark:` con `slate` + `indigo` como acento único.
- Densidad de tabla: `px-4 py-3` (igual que hoy). Números siempre a la derecha con `tabular-nums`.
- Estados: `Badge variant="success|danger"`, nunca texto de color suelto.
- Toda tabla dentro de `Table` (que ya aporta `overflow-x-auto` y las etiquetas móviles).
- Botones de cabecera: `whitespace-nowrap shrink-0`.
- Foco visible en todo control nuevo: `focus-visible:ring-2 focus-visible:ring-indigo-500`.
- Los iconos son Heroicons 24 outline, los ya usados en el repo. No dibujar iconos nuevos.

---

## 8. Backend — cambios mínimos

1. `CompanyController@index`: contar `staff_users_count`, `employees_count`, cargar `membershipPlan`, calcular `stats` para `StatBand`, aceptar filtros `status`, `at_limit`, `expiring`, `plan`.
2. `PayrollPeriodicityController`: nuevo `reorder(Request)`; `payrolls_count` ya existe.
3. `MembershipPlanController@index`: `companies_count` ya existe; añadir `features_json` al payload de Index (hoy solo se usa en Edit).
4. `SettingsController@update`: validar que la suma de `default_deductions.*.percent` ≤ 100 y que los umbrales de dificultad son estrictamente crecientes (mensaje en español).

---

## 9. Criterios de aceptación

- [ ] En Empresas, Periodicidad y Planes hay un control visible Tabla ⇄ Tarjetas; la elección persiste al recargar y es independiente por módulo.
- [ ] Cambiar de vista no pierde búsqueda, filtros ni página.
- [ ] Ninguna tabla desborda horizontalmente el contenedor a 1280px; las rejillas de tarjetas se comprimen sin salirse.
- [ ] Ningún botón de cabecera parte su texto en dos líneas a 1280px.
- [ ] Los límites de plan se ven como barra de uso en Empresas y en Editar empresa, con aviso visual desde el 90 %.
- [ ] Mi empresa tiene índice lateral pegajoso en `lg+`, acordeones en móvil y barra de guardado fija con contador de cambios.
- [ ] Periodicidad se reordena desde la lista y el nuevo orden persiste.
- [ ] Planes se puede leer como comparativa de tarjetas y administrar como tabla.
- [ ] Se respetan los permisos (`Can`) y `canEdit` en todas las acciones nuevas.
- [ ] Modo claro y oscuro correctos en los seis componentes nuevos.
