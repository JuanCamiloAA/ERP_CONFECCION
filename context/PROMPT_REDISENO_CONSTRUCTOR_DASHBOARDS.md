# Rediseño del módulo Constructor de dashboards — especificación de implementación

Aplica al proyecto `ERP_CONFECCION` (Laravel + Inertia + React + TypeScript + Tailwind v4).

Objetivo: llevar el **Constructor de dashboards** (super admin) a la piel `emp-*` de `resources/css/module-ui.css` y resolver los tres puntos ciegos del módulo actual: el listado no dice **quién ve cada widget** ni **de dónde sale el dato**, el editor construye la consulta **a ciegas** (la vista previa vive al final de una tarjeta, hay que bajar a buscarla) y la visibilidad es una **lista de casillas** por empresa que no deja comparar empresas entre sí.

Referencia de diseño: `Constructor de dashboards.dc.html` (6 marcos: `1a/1b` listado, `2a/2b` editor, `3a/3b` visibilidad).

---

## 0. Reglas heredadas (no negociables)

1. `import '../../../css/module-ui.css';` en cada página del módulo. Sin hojas nuevas.
2. Colores solo por variable `--emp-*`. Cero `slate-*` / `indigo-*` / `amber-*` / `rose-*` / hex crudo dentro del módulo.
3. Pesos 400 y 500; jerarquía por tamaño y espacio.
4. Primarios delineados (`emp-btn emp-btn-primary`), nunca rellenos. **Esto elimina el botón violeta relleno «Nuevo widget» y los `Button variant="primary"` que hoy hacen de pestañas en `WidgetFormFields`.**
5. Elevación = borde (`emp-card`); nada de `Card` + `CardHeader`. Las secciones del formulario usan cabecera 11 px uppercase + regla que se desvanece (`EmployeeFormSection`).
6. Iconos **Phosphor** (`@phosphor-icons/react`), 13–20 px. Se retiran los `@heroicons` del módulo… con **una excepción documentada**: el catálogo `KPI_ICON_OPTIONS` de `chart_config.icon` guarda nombres de Heroicons y el Dashboard los pinta con `HeroIcons[...]`. Ver §5.
7. Segmentado `emp-seg` en vez de desplegables de pocas opciones; todo segmentado lleva `white-space: nowrap` (ya está en `.emp-seg-item`).
8. Monoespaciada solo para lo que es código: nombre interno, tabla, SQL, variables `:company_id`. Una sola familia (`ui-monospace`), 11–12 px.
9. Móvil: tarjetas en vez de tabla bajo `lg`, campos 44 px con `font-size:16px`, botones 48 px, barra fija inferior con la acción primaria.
10. Rutas y permisos existentes se conservan: `super-admin.dashboard-widgets.{index,create,store,edit,update,destroy,preview,visibility}` y `super-admin.active-company`. El módulo sigue siendo solo para `is_super_admin`.

---

## 1. Lo que cambia (resumen)

| Hoy | Después |
| --- | --- |
| Columna «Asignaciones: 2» | Columna **«Quién lo ve»** con pastillas `Empresa · N roles` y `+N`; pastilla `--emp-danger` **«Nadie lo ve»** cuando `visibility_count = 0` |
| No se ve el origen del dato | Bajo el título: `payrolls · SUM(total_amount) · estado ≠ pagado` en monoespaciada, o `SELECT … FROM productions · 20 filas` en modo SQL |
| Sin métricas | Tres tarjetas: **activos (7 de 9)**, **asignaciones (14)**, **sin asignar (2)** |
| Estado como `Badge` | Interruptor real en la fila (PATCH `toggle-active`), sin entrar al editor |
| No hay filtros | Buscador + segmentado Activos/Inactivos/Todos + tipo + «cualquier asignación / sin asignar / por empresa» |
| Sin duplicar | Acción **Duplicar** (copia definición y apariencia, sin visibilidad) |
| Vista previa al final, 64 px de alto, hay que pulsar «Probar consulta» a ciegas | **Panel lateral fijo** con la vista previa al tamaño real de la tarjeta, el tiempo de ejecución y las filas leídas |
| El modo guiado no muestra qué SQL produce | Tarjeta **«SQL generado»** (solo lectura, copiable) con las variables de sesión resaltadas; se oculta en modo SQL avanzado porque duplicaría el textarea |
| Tipo de widget en un `<select>` | Cinco tarjetas con icono (KPI, barras, líneas, torta, tabla) |
| Icono del KPI en un `<select>` con nombres en inglés (`ClipboardDocumentListIcon`) | Rejilla de iconos: se elige **viendo** el icono |
| Refresco en un `<input type=number>` | Segmentado 30 s / 2 min / 5 min / 15 min (+ campo libre en «Otro») |
| Visibilidad: una tarjeta por empresa con casillas apiladas | **Matriz empresa × rol** con columna «Todos», empresas inactivas atenuadas, barra de cambios sin guardar y buscador |
| El aviso «esta consulta no filtra por empresa» aparece suelto | Se explica en el panel lateral y deshabilita la matriz completa |

---

## 2. Archivos

### Nuevos
| Archivo | Qué es |
| --- | --- |
| `resources/js/lib/dashboard-widgets.ts` | `TYPE_LABELS`, `TYPE_ICONS` (Phosphor), `REFRESH_PRESETS`, `describeQuery(widget)` → texto de origen del dato, `assignmentSummary(visibility)` → pastillas |
| `resources/js/Components/DashboardBuilder/WidgetFilterBar.tsx` | Buscador (debounce 300 ms) + segmentado de estado + tipo + asignación + contador |
| `resources/js/Components/DashboardBuilder/WidgetRow.tsx` | Fila de escritorio del listado (icono de tipo, origen del dato, pastillas de visibilidad, interruptor, acciones) |
| `resources/js/Components/DashboardBuilder/WidgetCard.tsx` | Tarjeta de listado en móvil |
| `resources/js/Components/DashboardBuilder/WidgetTypePicker.tsx` | Cinco tarjetas de tipo con icono |
| `resources/js/Components/DashboardBuilder/IconPicker.tsx` | Rejilla de iconos con «+N» que abre el resto en un modal |
| `resources/js/Components/DashboardBuilder/PreviewPanel.tsx` | Panel lateral: vista previa + metadatos de ejecución + «Probar consulta» |
| `resources/js/Components/DashboardBuilder/GeneratedSqlPanel.tsx` | SQL generado (solo lectura, `Copiar`, variables resaltadas) |
| `resources/js/Components/DashboardBuilder/VisibilityMatrix.tsx` | Matriz empresa × rol (escritorio) |
| `resources/js/Components/DashboardBuilder/VisibilitySheet.tsx` | Versión móvil: empresa desplegable con chips de rol de 44 px |
| `resources/js/Pages/SuperAdmin/DashboardWidgets/Visibility.tsx` | Pestaña/pantalla de visibilidad (sale del `Edit.tsx`) |

### Reescritos
- `resources/js/Pages/SuperAdmin/DashboardWidgets/Index.tsx`
- `resources/js/Pages/SuperAdmin/DashboardWidgets/Create.tsx` y `Edit.tsx` (pasan a ser cascarón con las tres pestañas: **Definición / Apariencia / Visibilidad**)
- `resources/js/Components/DashboardBuilder/WidgetFormFields.tsx` (se parte: formulario a la izquierda, `PreviewPanel` + `GeneratedSqlPanel` a la derecha)
- `resources/js/Components/DashboardBuilder/GuidedQueryForm.tsx` (misma lógica, controles `emp-*`)

### Backend
- `app/Http/Controllers/SuperAdmin/DashboardWidgetController.php`:
  - `index()`: búsqueda, filtros (`state`, `type`, `assignment`), métricas y **eager load** de la visibilidad resumida (`company.name`, `role.display_name`) para las pastillas.
  - `toggleActive(DashboardWidget $widget)`: `PATCH` que invierte `is_active` (nueva ruta `super-admin.dashboard-widgets.toggle-active`).
  - `duplicate(DashboardWidget $widget)`: `POST` que clona definición, `chart_config` y refresco con `name = "{name}_copia"`, `is_active = false`, **sin** visibilidad (nueva ruta `…​.duplicate`).
  - `preview()`: además del payload actual, devolver `meta: { rows, duration_ms, company_label, generated_sql }`.
  - Servicio de consulta guiada: exponer el SQL con placeholders sin ejecutarlo (`toSqlWithBindings()`), para `GeneratedSqlPanel`.
- `routes/web.php`: `toggle-active`, `duplicate`, y `visibility` como `GET` (pantalla) además del `PUT` que ya existe.

### No se toca
`config/dashboard_builder.php` (catálogo de tablas, scopes y variables), `DynamicChart.tsx`, `useWidgetData.ts`, la validación de SQL de solo lectura ni `dashboard-builder-types.ts` salvo el `meta` del preview.

---

## 3. Listado — `DashboardWidgets/Index.tsx` (marcos `1a` / `1b`)

### Props
```ts
interface WidgetRow {
    id: number; name: string; title: string; type: WidgetType;
    query_mode: 'builder' | 'sql';
    query_summary: string;              // "payrolls · SUM(total_amount) · estado ≠ pagado"
    refresh_interval_seconds: number;
    is_active: boolean;
    visibility_count: number;
    assignments: { company: string; roles_label: string }[]; // roles_label: "2 roles" | "todos"
}

interface Props {
    widgets: PaginatedResponse<WidgetRow>;
    filters: { search: string; state: 'active' | 'inactive' | 'all'; type: string | null; assignment: 'any' | 'none' | string };
    metrics: { active: number; total: number; assignments: number; companies: number; roles: number; unassigned: number };
    companies: { id: number; name: string }[];
}
```

### Estructura
1. **Contenedor**: `emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8`.
2. **Cabecera**: `h1` 24 px «Constructor de dashboards»; descripción 13 px: «Widgets dinámicos que se muestran en el Dashboard de las empresas y roles asignados. Cada widget es una consulta guiada (o SQL de solo lectura) con su propia apariencia.» A la derecha «Ver el dashboard» (`Eye`, `emp-btn emp-btn-sm`) y «Nuevo widget» (`emp-btn emp-btn-sm emp-btn-primary`), esta última oculta en móvil.
3. **Tres métricas** (`emp-card p-[17px]`, valor 27 px):
   - **Widgets activos** — `7 de 9` (el «de 9» en 15 px `--emp-subtle`), valor en `--emp-accent-on`; meta «2 inactivos · no se pintan en ningún dashboard».
   - **Asignaciones** — `14`; meta «6 empresas · 11 roles distintos».
   - **Sin asignar** — valor en `--emp-danger`; meta «Existen y están activos, pero nadie los ve».
4. **Barra de filtros** (`WidgetFilterBar`) con `border-bottom`, pegajosa en móvil: buscador `emp-field pl-8` («Buscar por título, nombre interno o tabla…»), segmentado 260 px **Activos | Inactivos | Todos**, select de tipo (150 px), select de asignación (170 px) y contador a la derecha «9 widgets · 2 sin asignar». Cada cambio recarga con `preserveState` + `replace`.
5. **Tabla de escritorio** (`hidden lg:block`), rejilla compartida:
   ```ts
   export const WIDGET_GRID = 'minmax(0,1fr) 110px 120px 210px 96px 92px 104px';
   ```
   | Col | Contenido |
   | --- | --- |
   | Widget | cuadro de 34 px con el icono del tipo (`emp-pill-accent` cuando está activo, `--emp-field-alt` cuando no) + título 14 px `Link` al editor + `query_summary` 11.5 px, tabla y función en monoespaciada |
   | Tipo | 13 px `--emp-muted` |
   | Consulta | `emp-pill-accent` «Guiado» o `emp-pill` con icono `Code` «SQL avanzado» |
   | Quién lo ve | pastillas `Empresa · N roles` (máx. 2) + `+N`; si `visibility_count = 0`: pastilla `--emp-danger` con `EyeSlash` «Nadie lo ve» + línea 11 px «Falta asignar empresa y rol» |
   | Refresco | 12.5 px derecha, formateado (`2 min`, `10 min`) |
   | Estado | interruptor 32×18 px + texto «Activo/Inactivo»; el `onChange` llama a `toggle-active` con `preserveScroll` |
   | Acciones | `PencilSimple` (editar), `Copy` (duplicar), menú `DotsThreeVertical` con «Ver en el dashboard», «Ver asignaciones» y «Eliminar» (`--emp-danger`) |
   Fila `emp-hover-row emp-row-sep`, `padding: 11px 12px`.
6. **Vacío**: `emp-card p-6` centrado, 13 px: «Aún no hay widgets. Crea el primero.» + botón primario.
7. **Paginación** igual que el resto de módulos («Mostrando 1–3 de 9» + chips de 30 px).
8. **Móvil** (`WidgetCard`): icono 36 px + título + `query_summary`; fila de pastillas (`KPI · Guiado`, asignaciones, «Nadie lo ve»); pie con interruptor a 40 px de alto y botón «Editar» (o «Asignar» si `visibility_count = 0`) a 48 px. Barra inferior fija con «Nuevo widget».

---

## 4. Editor — `Create.tsx` / `Edit.tsx` + `WidgetFormFields.tsx` (marcos `2a` / `2b`)

### Cascarón
- Migas `Constructor de dashboards › {título}`.
- `h1` 24 px con el título del widget + pastilla de estado; meta 13 px: «Tarjeta KPI · consulta guiada sobre `payrolls` · lo ven 2 empresas · guardado hace 3 días».
- Acciones: «Volver» (`emp-btn`), «Duplicar» (`emp-btn`), «Guardar cambios» (`emp-btn emp-btn-primary`).
- **Pestañas** `emp-seg` de 420 px: **Definición | Apariencia | Visibilidad**, la última con contador de asignaciones. En `Create.tsx` la pestaña Visibilidad va deshabilitada con ayuda: «Disponible después de crear el widget».

### Columna izquierda (formulario, `flex-1`)
Tres secciones con cabecera 11 px uppercase + regla que se desvanece:

1. **Datos básicos** (rejilla 2 columnas, `gap-[14px]`)
   - `Nombre interno` (monoespaciada, ayuda «Solo lo ve el super admin en el listado»).
   - `Título visible` (ayuda «Es el título que leen los usuarios en su Dashboard»).
   - `Tipo de widget` a ancho completo: `WidgetTypePicker`, cinco botones de 66 px de alto (icono 20 px + etiqueta 12 px); el activo con borde `--emp-accent` y relleno `--emp-accent-fill`.
   - `Refresco`: segmentado **30 s | 2 min | 5 min | 15 min** (+ opción «Otro» que muestra el `emp-field` numérico); ayuda «Cada cuánto vuelve a consultar el dashboard abierto (15 s – 60 min)».
   - `Descripción` (`emp-field`).
   - `Widget activo`: fila con interruptor dentro de un borde `--emp-row`, ayuda «Inactivo lo oculta en todos los dashboards sin borrar sus asignaciones».
2. **Consulta**
   - Segmentado 320 px **Modo guiado | SQL avanzado** (reemplaza los dos `Button` de hoy). **El estado activo debe seguir a `query_mode`.**
   - *Modo guiado* (`GuidedQueryForm` con controles `emp-*`):
     - Fila de tres: `Tabla`, `Columna (métrica)`, `Agregación`. Bajo `Tabla`, cuando `has_company_scope`: línea 11 px en `--emp-ok` «Filtra por empresa automáticamente»; si no, línea en `--emp-danger` «Esta tabla no tiene company_id».
     - `Agrupar por` + `Granularidad` (solo para barras/líneas/torta), `Columnas a mostrar` + `Límite de filas` (solo tabla).
     - **Filtros predefinidos** (los `scopes` del catálogo) como tarjetas de casilla en rejilla de 2: título 13 px + ayuda 11 px; la marcada con borde `--emp-accent` y fondo `--emp-accent-tint`.
     - **Filtros por columna**: una fila por filtro con rejilla `minmax(0,1fr) 168px 150px minmax(0,1fr) 30px` → columna, operador, segmentado **Valor fijo | Variable**, valor (input, `date` o select de variables en monoespaciada con borde `--emp-accent`), y papelera `--emp-danger`. Nota `emp-note`: «Con una variable de sesión el valor se resuelve según quien mire el dashboard: cada empleado verá solo lo suyo, sin duplicar el widget por persona.»
   - *SQL avanzado*: `textarea.emp-field` monoespaciada de 7 filas + chips de validación en vivo (`--emp-ok` cuando pasa, `--emp-danger` cuando no): «Una sola sentencia SELECT», «Incluye `:company_id`», «Alias requeridos: `label`, `value`». Nota con las variables disponibles (`:company_id`, `:user_id`, `:employee_id`, las que devuelva `availableSessionVariables`).
3. **Apariencia** (visible según el tipo; para KPI)
   - `IconPicker`: botones de 38 px con el icono renderizado + «+21» que abre el catálogo completo en modal con buscador. Ayuda: «Se elige viendo el icono, no su nombre en inglés».
   - `Subtítulo (opcional)` y `Formatear el valor como moneda` (fila con interruptor).
   - Para gráficos: paleta de series (se conserva `chart_config.color`) mostrada como muestras de 24 px, no como `<select>`.

### Columna derecha (panel fijo, `w-[420px] lg:sticky lg:top-[84px]`)
1. **Vista previa en vivo** (`emp-card`): cabecera con kicker y botón «Probar consulta» (`Play`, `emp-btn emp-btn-sm emp-btn-primary`); dentro, la tarjeta real renderizada por `DynamicChart` sobre `--emp-field-alt` con radio 12 px (KPI: icono 44 px + valor 28 px + subtítulo). Debajo, metadatos 11 px: «Ejecutado hace 4 s con **Confecciones Aurora** · 2 filas leídas · 38 ms». Error de consulta → `emp-note` en `--emp-danger` con el mensaje del backend, **sin borrar** la última vista previa buena.
2. **SQL generado** (`GeneratedSqlPanel`): `<pre>` monoespaciado 11.5 px sobre `--emp-field`, palabras clave en `--emp-accent-on` y variables en `--emp-accent-line`; botón «Copiar». Nota: «Solo lectura. Las variables en acento se reemplazan al pintar el dashboard de cada usuario.» **Se oculta cuando `query_mode === 'sql'`** (ahí el textarea ya es la fuente).
3. **Quién lo verá**: pastillas de asignación + enlace «Editar visibilidad» + línea «2 empresas · 3 asignaciones. Guardar el widget no cambia la visibilidad; se guarda aparte.»

### Móvil (`2b`)
Pestañas a 38 px; **vista previa arriba** (tarjeta con «Probar» a 40 px) para no construir a ciegas; secciones apiladas con campos de 44 px; `WidgetTypePicker` en rejilla de 3; tarjeta de SQL generado al final; barra inferior con «Descartar» (48×48) + «Guardar cambios» (48 px).

---

## 5. Iconos: la excepción documentada

`chart_config.icon` guarda nombres de **Heroicons** (`KPI_ICON_OPTIONS`) y el Dashboard los pinta con `HeroIcons[nombre]`. Dos opciones, en este orden de preferencia:

1. **Migrar el catálogo a Phosphor** (recomendado): mapa `HEROICON_TO_PHOSPHOR` en `lib/dashboard-widgets.ts`, se guarda ya el nombre Phosphor y el Dashboard resuelve `PhosphorIcons[nombre]` con *fallback* al mapa para los widgets antiguos. Sin migración de datos.
2. Si no se migra: el `IconPicker` sigue guardando el nombre Heroicon pero **renderiza el icono**, nunca su nombre; el resto del módulo usa Phosphor.

Decidir esto **antes** de tocar el editor; es la única fuente legítima de Heroicons en el módulo.

---

## 6. Visibilidad — `DashboardWidgets/Visibility.tsx` (marcos `3a` / `3b`)

Ruta nueva `GET super-admin.dashboard-widgets.visibility` (misma que ya hace `PUT`). Conserva íntegra la lógica de `Edit.tsx`: filas `{company_id, role_id}`, `role_id = null` significa «todos los roles», `canFilterByCompany` derivado de `has_company_scope` o de la presencia literal de `:company_id`, y el `PUT` con `position` por índice.

1. Migas `Constructor › {widget} › Visibilidad`; `h1` «Visibilidad del widget»; descripción: «Marca la casilla donde el widget debe aparecer. Una empresa con “Todos los roles” ignora las marcas por rol.» Acciones: «Volver al editor» y «Guardar visibilidad» (primario). Pestañas iguales a las del editor, con «Visibilidad» activa.
2. **Barra de filtros**: buscador de empresa (320 px) + segmentado **Todas | Solo asignadas | Activas** + contador «6 empresas · 3 asignaciones».
3. **Matriz** (`VisibilityMatrix`), rejilla con **piso en la columna de nombre**:
   ```ts
   export const VISIBILITY_GRID = 'minmax(240px,1fr) 92px repeat(var(--roles), 76px)';
   ```
   - Cabecera: `Empresa` · `Todos` (en `--emp-accent-on`) · una columna por rol (11 px uppercase; abreviar «Contab.», «RR. HH.»). Si la empresa tiene más de 6 roles, la matriz scrollea horizontal con la columna de empresa fija (`position: sticky; left: 0`).
   - Fila por empresa: nombre 14 px + línea 11.5 px «NIT … · N usuarios · N roles marcados»; casillas de 16 px centradas en celdas de 38 px con `:hover` en `--emp-accent-tint`.
   - Empresa con «Todos los roles»: fila con `--emp-row-hover` + `inset 2px 0 0 var(--emp-accent-line)`, línea en `--emp-accent-on` «Todos los roles · las marcas por rol quedan desactivadas» y casillas de rol `disabled` al 45 %.
   - Empresa inactiva: fila `emp-row-off` + pastilla «Inactiva» y meta «Suscripción suspendida · no pinta dashboards».
   - Si `!canFilterByCompany`: **toda** la matriz `disabled` + `emp-note` en `--emp-danger` arriba con el texto actual («Esta consulta no filtra por empresa… solo puede usarse en la vista consolidada del super admin»).
4. **Barra de cambios** sobre `emp-strip`: «2 empresas · 3 asignaciones sin guardar» + «Descartar» y «Guardar visibilidad» (`emp-btn-sm`). Los errores del `PUT` se listan en `emp-note` con `--emp-danger`.
5. **Panel lateral 300 px**: tarjeta «Este widget» (icono, título, tipo · modo · tabla) con nota en `--emp-ok` cuando la consulta filtra por empresa; tarjeta «Cuándo no se puede asignar» con el ejemplo del aviso; tarjeta «Orden en el dashboard» con enlace «Ver como lo verá {empresa}».
6. **Móvil** (`VisibilitySheet`): tarjeta del widget arriba, buscador, y una tarjeta desplegable por empresa: «Todos los roles» como fila de 48 px y los roles como **chips de 44 px** que se marcan con `Check` (borde `--emp-accent` + relleno cuando están activos). Barra inferior fija con «Guardar visibilidad».

---

## 7. Accesibilidad y detalles

- Toda casilla de la matriz lleva `aria-label` con empresa y rol («Administrador en Confecciones Aurora»); la columna «Todos» también.
- El interruptor del listado es un `<button role="switch" aria-checked>` con `aria-label` «Activar/Desactivar {título}».
- El color nunca es el único distintivo: «Nadie lo ve» lleva icono `EyeSlash`; los chips de validación del SQL llevan `CheckCircle` / `Warning`.
- Los segmentados llevan `white-space: nowrap` (ya en `.emp-seg-item`); las etiquetas largas se abrevian, no se parten.
- Foco temático heredado de `module-ui.css`; ningún `focus:ring-indigo-500` nuevo.
- `<pre>` del SQL con `tabindex="0"` para poder desplazarlo con teclado.

---

## 8. Criterios de aceptación

1. Ni un `slate-*`, `indigo-*`, `amber-*` o `rose-*` en `resources/js/Pages/SuperAdmin/DashboardWidgets/**` ni en `resources/js/Components/DashboardBuilder/**`; los únicos Heroicons permitidos son los del catálogo `chart_config.icon` mientras no se migre (§5).
2. Desde el listado, sin abrir el editor, se sabe: qué mide el widget, de qué tabla sale, quién lo ve y si está activo; y se puede activar/desactivar y duplicar.
3. En el editor, la vista previa y el SQL generado están visibles **sin desplazarse** en escritorio ≥ 1280 px, y en móvil por encima del formulario.
4. El segmentado Guiado/SQL, el tipo de widget y el modo de valor de cada filtro reflejan siempre el estado real del formulario (nada de pestañas pintadas a mano).
5. La matriz de visibilidad muestra el nombre completo de la empresa en dos líneas como máximo, sin elipsis, hasta 6 roles sin scroll.
6. Guardar el widget y guardar la visibilidad siguen siendo dos peticiones distintas, con los mismos payloads que hoy (`PUT …/update` y `PUT …/visibility` con `position`).
7. Sin migraciones; `config/dashboard_builder.php`, la validación de SQL de solo lectura y `DynamicChart` intactos.
