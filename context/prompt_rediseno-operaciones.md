# Rediseño del módulo Operaciones — especificación de implementación

Aplica al proyecto `ERP_CONFECCION` (Laravel + Inertia + React + TypeScript + Tailwind v4).

Objetivo: llevar el módulo **Operaciones** a la misma piel de los módulos ya rediseñados (**Empleados** y **Producción**), es decir a las clases `emp-*` de `resources/css/module-ui.css`, sin cambiar el backend salvo lo que se indica explícitamente.

Referencia de diseño: `Operaciones rediseño.dc.html` (5 pantallas: listado, nueva, editar, ficha, modal de creación rápida).

---

## 0. Reglas que hereda de Empleados/Producción (no negociables)

1. **Una sola hoja de tokens**: importar `import '../../../css/module-ui.css';` en cada página del módulo. No crear una hoja nueva ni duplicar variables.
2. **Colores solo por variable**: `var(--emp-bg)`, `--emp-surface`, `--emp-field`, `--emp-field-alt`, `--emp-border`, `--emp-row`, `--emp-text`, `--emp-muted`, `--emp-subtle`, `--emp-faint`, `--emp-accent`, `--emp-accent-on`, `--emp-accent-line`, `--emp-accent-fill`, `--emp-accent-tint`, `--emp-row-hover`, `--emp-danger`, `--emp-ok`. Nada de `slate-*` ni `indigo-*` dentro del módulo.
3. **Dos pesos de fuente**: 400 y 500. La jerarquía es tamaño y espacio (ya lo fuerza `.emp-form`).
4. **Primarios delineados**: `emp-btn emp-btn-primary` (borde acento sobre transparente). Nunca un relleno sólido de acento.
5. **Elevación = borde**: `emp-card` (`box-shadow: 0 0 0 1px var(--emp-border)`), sin sombras apiladas.
6. **Iconos Phosphor** (`@phosphor-icons/react`), tamaños 13–17px, como en Producción. Se abandonan los `@heroicons` dentro del módulo.
7. **Regla que se desvanece** en lugar de tarjeta con cabecera para separar secciones de formulario: reutilizar `EmployeeFormSection` / `EmployeeFadingRule`.
8. **Foco**: nunca el anillo del navegador; ya lo cubre `.emp-form`/`.emp-scope`.
9. **Móvil**: tarjetas en lugar de tabla por debajo de `lg`, objetivos táctiles ≥44px, barra fija inferior con la acción primaria.
10. **Permisos y rutas intactos**: se conservan `Can`, `route()`, `usePermissions()` y los nombres de ruta actuales.

---

## 1. Archivos a tocar

### Nuevos
| Archivo | Qué es |
| --- | --- |
| `resources/js/Components/Operations/OperationFormLayout.tsx` | Armazón de 3 columnas (índice, formulario, panel) + índice lateral + tarjeta de panel. Puede ser un re-export delgado de `EmployeeFormLayout` con sus propias secciones. |
| `resources/js/Components/Operations/OperationDifficultyCard.tsx` | Tarjeta del panel: dificultad calculada + escala de cortes. |
| `resources/js/Components/Operations/OperationFilterBar.tsx` | Buscador + segmentado de estado + filtro de dificultad + contador. |
| `resources/js/Components/Operations/OperationRow.tsx` | Fila de escritorio con checkbox, precio editable en línea y menú de acciones. |
| `resources/js/Components/Operations/OperationCard.tsx` | Tarjeta de la operación para móvil. |
| `resources/js/Components/Operations/OperationBulkBar.tsx` | Barra de acciones masivas (aparece con selección > 0). |
| `resources/js/Pages/Operations/Show.tsx` | Ficha de la operación (nueva pantalla). |

### Reescritos
- `resources/js/Pages/Operations/Index.tsx`
- `resources/js/Pages/Operations/Create.tsx`
- `resources/js/Pages/Operations/Edit.tsx`
- `resources/js/Components/Operations/OperationQuickCreateModal.tsx`

### Backend
- `app/Http/Controllers/OperationController.php` (métricas, filtros, `show`, duplicar, acciones masivas, precio en línea)
- `routes/web.php` (rutas nuevas)
- `app/Http/Requests/Operation/*` (validación de los endpoints nuevos)
- `app/Models/Operation.php` (scopes de filtro si hacen falta)

### No se toca
`resources/css/module-ui.css` — ya trae todo lo necesario. Solo si algo falta, se **añade** ahí (nunca en una hoja paralela).

---

## 2. Listado — `Pages/Operations/Index.tsx`

### Props que debe recibir del controlador
```ts
interface Props {
    operations: PaginatedResponse<Operation & { references_count: number; productions_count: number }>;
    filters: { search: string; status: string; difficulty: string };  // status: 'active' | 'inactive' | 'all'
    metrics: { avg_price: number; avg_minutes: number; active: number; avg_difficulty_level: number };
}
```

### Estructura (de arriba a abajo)
1. **Contenedor**: `<div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">` (idéntico a Empleados).
2. **Cabecera**: `h1` 24px «Operaciones» + descripción 13px muted: «Catálogo del taller: lo que se paga por cada operación y la dificultad que pondera el ranking.» A la derecha, dos botones `emp-btn emp-btn-sm`:
   - «Creación rápida» (icono `Lightning`) → abre `OperationQuickCreateModal`.
   - «Nueva operación» (`emp-btn-primary`, icono `Plus`) → `operations.create`. Oculto en móvil (`max-sm:hidden`), donde vive en la barra fija inferior.
3. **Métricas** (solo dos, y con línea de contexto de 11px):
   - `PRECIO PROMEDIO` → `formatCurrency(metrics.avg_price)`; meta: «{metrics.active} operaciones activas».
   - `MINUTOS PROMEDIO` → `6,4 min`; meta: «Dificultad media del catálogo: {difficultyLabel(metrics.avg_difficulty_level)}».
   - Markup: `emp-card min-w-[212px] p-[17px]`, kicker `emp-kicker`, valor `text-[27px] leading-none`. En móvil, fila con scroll horizontal (`-mx-4 flex gap-2.5 overflow-x-auto px-4`), como en Producción.
4. **Barra de filtros** (`OperationFilterBar`), pegajosa en móvil igual que en Empleados (`sticky top-16 … sm:static`):
   - Buscador `emp-field pl-8` con `MagnifyingGlass` 15px, `sm:max-w-[420px] sm:flex-1`, debounce 300ms; escribe el filtro `search`.
   - Segmentado `emp-seg` con `Activas | Inactivas | Todas` (`emp-seg-item` / `emp-seg-on`), ancho `sm:w-[240px]`.
   - Select `emp-field w-[190px]` de dificultad: `Toda dificultad`, `1 · Muy baja` … `5 · Muy alta`, con `CaretDown` 13px absoluto a la derecha. Oculto en móvil (`max-sm:hidden`), donde va dentro del panel de filtros.
   - Contador a la derecha: `{formatNumber(total)} operaciones`, 12px `--emp-subtle`.
   - Todo cambio de filtro dispara `router.get(route('operations.index'), params, { preserveState: true, preserveScroll: true, replace: true })`.
5. **Barra de selección** (`OperationBulkBar`), solo si hay selección: estilo `emp-note` (borde acento a la izquierda), texto «N operaciones seleccionadas» + `emp-btn emp-btn-sm` «Activar», «Inactivar» y un ghost «Limpiar».
6. **Tabla de escritorio** (`hidden lg:block`), sin caja: cabecera con `border-bottom: 1px solid var(--emp-border)`, celdas 11px uppercase `tracking-[0.09em]` `--emp-subtle`; filas con `emp-row-sep` + `emp-hover-row`, y `emp-row-off` si `!is_active`.
   Columnas exactamente:
   | Col | Contenido |
   | --- | --- |
   | checkbox (34px) | selección de fila; en la cabecera, seleccionar todo. `accent-color: var(--emp-accent)` |
   | Operación | nombre 14px como `Link` a `operations.show`; descripción 12px `--emp-subtle` debajo |
   | Precio base (derecha, 150px) | **editable en línea** (ver §2.1) |
   | Dificultad (130px) | `emp-pill` con la etiqueta de texto (`Muy baja`…`Muy alta`). Sin escala gráfica, sin número solo |
   | Estado (110px) | `emp-pill` «Activa»; `emp-pill-warn` «Inactiva» |
   | acciones (110px) | icon-buttons 30px: `PencilSimple` (editar), `Copy` (duplicar), `DotsThreeVertical` (menú Headless UI con Editar / Duplicar / Inactivar-Reactivar / Eliminar, este último en `--emp-danger`) |
7. **Móvil** (`lg:hidden`): `OperationCard` — `emp-card p-3`, nombre 14px, descripción 12px, fila de `emp-pill` (dificultad, precio, estado) y el menú de acciones a la derecha.
8. **Paginación**: idéntica a Empleados — «Mostrando X–Y de Z» 12px + botones 30px con `emp-seg-on` en la página activa.
9. **Barra fija inferior** en móvil con «Nueva operación» (`emp-btn emp-btn-primary w-full`), dentro de `Can permission="operations.index.create"`.
10. **Vacío**: `emp-card p-6 text-center text-[13px]` con «No hay operaciones con este filtro.» y, si hay filtros activos, un enlace subrayado «Limpiar filtros» en `--emp-accent-on`.

### 2.1 Precio editable en línea
- Estado local: `editingId: number | null`, `draft: string`.
- Vista normal: botón fantasma de 30px que muestra `$ 240,00` y un `PencilSimple` 13px en `--emp-faint`; el lápiz se hace visible en `:hover`/`:focus-visible` de la fila (o siempre, si resulta más descubrible).
- Vista de edición: `emp-field` de 30px de alto y ~70px de ancho, alineado a la derecha, con prefijo `$`; a su lado, botón de confirmar (`Check`, borde acento) y cancelar (`X`, ghost).
- `Enter` confirma, `Escape` cancela, el foco entra al input al abrir.
- Guarda con `router.patch(route('operations.price', op.id), { base_price }, { preserveScroll: true, preserveState: true })`.
- Optimista: se pinta el valor nuevo al confirmar y se revierte con `onError` + `toast.error('No se pudo actualizar el precio.')`.
- Sin permiso `operations.index.edit`, el precio es texto plano (no botón).

---

## 3. Formulario — `Create.tsx` y `Edit.tsx`

Se abandona la `Card` única con grid de 2 columnas. Layout de tres columnas, igual que Empleados (`OperationFormLayout`, reutilizando la mecánica de `EmployeeFormLayout`).

### Secciones (constante compartida, en `OperationFormLayout.tsx`)
```ts
export const OPERATION_SECTIONS = [
    { id: 'identidad', label: 'Identidad' },
    { id: 'precio',    label: 'Precio y tiempo' },
    { id: 'estado',    label: 'Disponibilidad' },
];
```

### Cabecera (ancho completo, pegajosa bajo el header de 64px)
- Kicker 11px uppercase: «Operaciones · Editar» / «Operaciones · Nueva».
- `h1` 20px: el nombre de la operación (en Editar) o «Nueva operación».
- Pastillas de contexto (`emp-pill`): estado («Activa» / «Se creará activa») y uso («12 referencias · 1.840 u este mes» / «Sin uso todavía»).
- Acciones: «Cancelar» (`emp-btn emp-btn-ghost`, `ArrowLeft`) → `operations.index`; «Guardar» (`emp-btn emp-btn-primary`, `Check`, `disabled` mientras `processing`).

### Columna central
1. **Identidad** (paso 1, «Obligatorio») — `EmployeeFormSection`:
   - `Nombre` (`emp-field`, requerido, asterisco en `emp-req`), ayuda `emp-help`: «Así se ve al registrar producción; el taller la busca por estas palabras.»
   - `Descripción` (`textarea.emp-field`, 3 filas).
2. **Precio y tiempo** (paso 2, «Obligatorio») — grid `sm:grid-cols-2`:
   - `Precio base`: campo compuesto con prefijo `$` (mismo patrón que `.emp-compound`), `emp-help`: «Lo que se paga por unidad si la referencia no fija otro precio.»
   - `Minutos estándar`: sufijo `min`, `step 0.1`, `min 0.1`, `emp-help`: «Define el grado de dificultad automáticamente.»
   - Debajo, `emp-note` **viva**: «8,0 min → dificultad Media (3). Si subes de 15 min pasa a Alta y el ranking la pondera más.» Se recalcula con `levelFromMinutes(minutes, thresholds)`; en Create, mientras no haya minutos: «Escribe los minutos y aquí aparece la dificultad que tendrá. Los cortes del taller son 3 / 7 / 15 / 25 min.»
3. **Disponibilidad** (paso 3, «Opcional») — `emp-card p-[17px]` con el switch a la derecha, título 13px «Operación activa» y ayuda 11px: «Las inactivas no se ofrecen al registrar producción ni al armar una referencia; lo ya registrado no cambia.» El switch se repinta con tokens: pista `--emp-accent-fill` + `inset 0 0 0 1px var(--emp-accent)`, perilla `--emp-accent-line` (apagada: `--emp-faint`).

### Panel derecho (`aside`, 292px, pegajoso)
1. **Dificultad calculada** (`OperationDifficultyCard`): título 13px, ayuda «No se edita a mano: sale de los minutos», valor 27px en `--emp-accent-on` («Media» / «—»), meta «Nivel 3 de 5 · 8,0 min», regla, y la escala de cortes leída de `difficultyMinuteThresholds` (`hasta 3 min`, `3 – 7`, `7 – 15`, `15 – 25`, `más de 25`) con el nivel vigente resaltado en `--emp-accent-on`.
2. **Pago por minuto**: `base_price / estimated_minutes` formateado, 27px; meta con el promedio del catálogo.
3. **Uso** (solo en Editar): Referencias, Registros de producción, Último registro — filas `label / valor`.

### Índice lateral (196px)
`emp-nav-item` / `emp-nav-on`, con el mismo observador de scroll de `EmployeeFormNav` (posición en documento, nunca `scrollIntoView`).

### Móvil
- Índice oculto; panel al final del flujo.
- Por debajo de 640px, formulario en una columna con barra fija inferior: «Cancelar» + «Guardar» (`emp-btn` a 48px de alto).

---

## 4. Ficha — `Pages/Operations/Show.tsx` (nueva)

Ruta `GET /operations/{operation}` → `operations.show`, permiso `operations.index.view`.

Props: `operation`, `metrics { units_month, value_month, people_month, avg_daily }`, `references` (código, nombre, precio pivote, minutos pivote, estado), `productions` (últimos 10: fecha, empleado, referencia, cantidad, valor).

Estructura:
1. Enlace de vuelta (kicker con `ArrowLeft`, «Operaciones»), `h1` 24px con el nombre, fila de `emp-pill`: estado, «Dificultad media» (`emp-pill-accent`), descripción/categoría.
2. Acciones: «Duplicar» (`Copy`), «Inactivar» (`Prohibit`), «Editar» (`emp-btn-primary`, `PencilSimple`).
3. Cuatro `emp-card` de métricas: Precio base, Minutos estándar, Pago por minuto, Unidades del mes.
4. Dos columnas:
   - Izquierda: sección «Referencias que la usan» (contador + «Ver todas», tabla `Código / Referencia / Precio en la ref. / Min.`) y sección «Producción reciente» (`Fecha / Empleado / Referencia / Cant. / Valor`). Ambas con encabezado + regla que se desvanece, filas con `emp-row-sep`.
   - Derecha (`aside` 292px): «Datos» (descripción, creada, última actualización con autor) y «Este mes» (valor pagado, personas que la hicieron, promedio diario).
5. En móvil, las dos tablas pasan a listas de tarjetas `emp-card`.

Además: el nombre en el listado (escritorio y móvil) apunta aquí.

---

## 5. Modal de creación rápida — `OperationQuickCreateModal.tsx`

Se mantiene el comportamiento (POST `operations.store` por axios, 422 → errores por campo, `onCreated` devuelve la operación para seleccionarla en la referencia) y se cambia la piel:

- Envolver el contenido del modal en `.emp-scope` (el modal se pinta en un portal; las variables ya están en `:root`, por eso funcionan).
- Backdrop `rgba(10,11,18,0.62)`; diálogo 560px, `emp-card` (radio 14, borde por sombra) más una sombra ambiental suave.
- Cabecera: kicker «Referencia REF-2214 · Jean clásico» (la referencia desde la que se abre), título 16px «Nueva operación», botón `X` ghost. Regla que se desvanece bajo la cabecera y sobre el pie.
- Cuerpo: grid 2 columnas — Nombre (span 2), Precio base (prefijo `$`), Minutos estándar (sufijo `min`), Descripción (span 2, 2 filas) y `emp-note` con la dificultad calculada: «9,5 min → dificultad Media. Se guarda en el catálogo y queda seleccionada en esta referencia.»
- Pie: a la izquierda el switch «Activa» compacto (36×20); a la derecha «Cancelar» (ghost) y «Guardar y seleccionar» (`emp-btn-primary`).
- Se elimina el `className` con `indigo-*` que hoy parchea el botón primario.

---

## 6. Backend

### `OperationController@index`
```php
$query = Operation::query()->withCount(['references', 'productions']);

if ($search !== '') {
    $query->where('name', 'like', "%{$search}%");
}

// status: active | inactive | all  (por defecto 'active')
if ($status === 'active')   { $query->where('is_active', true); }
if ($status === 'inactive') { $query->where('is_active', false); }

// difficulty: 1..5
if ($difficulty !== '') { $query->where('difficulty_level', (int) $difficulty); }
```
Métricas (sobre la empresa activa, no sobre la página):
```php
'metrics' => [
    'avg_price'   => (float) Operation::where('is_active', true)->avg('base_price'),
    'avg_minutes' => (float) Operation::where('is_active', true)->avg('estimated_minutes'),
    'active'      => Operation::where('is_active', true)->count(),
    'avg_difficulty_level' => (int) round(Operation::where('is_active', true)->avg('difficulty_level')),
],
```
Devolver también `filters => ['search' => $search, 'status' => $status, 'difficulty' => $difficulty]`.

### Endpoints nuevos (`routes/web.php`)
| Verbo | URI | Nombre | Qué hace |
| --- | --- | --- | --- |
| GET | `/operations/{operation}` | `operations.show` | Ficha con referencias, producción reciente y métricas del mes |
| PATCH | `/operations/{operation}/price` | `operations.price` | Solo `base_price`; para la edición en línea. Responde redirect back con flash |
| POST | `/operations/{operation}/duplicate` | `operations.duplicate` | Copia nombre + « (copia)», precio, minutos y descripción; `is_active = true`; **no** copia vínculos con referencias; redirige a `operations.edit` de la copia |
| POST | `/operations/bulk-status` | `operations.bulk-status` | `{ ids: number[], is_active: bool }`; actualiza en una consulta y devuelve flash «N operaciones actualizadas.» |

Notas:
- `operations.price` recalcula nada de dificultad (la dificultad depende de minutos, no del precio).
- Cualquier cambio de `estimated_minutes` sigue recalculando `difficulty_level` con `OperationDifficulty::levelFromMinutes` en `store`/`update` — no duplicar esa lógica en el front (el front solo previsualiza).
- Validar todo en `FormRequest`s nuevos (`UpdateOperationPriceRequest`, `BulkOperationStatusRequest`) y respetar `TenantContext` en todos ellos.
- Permisos: `operations.index.edit` para precio, duplicar y masivas; `operations.index.view` para la ficha. Registrar las páginas nuevas donde se declaran los permisos del módulo.

---

## 7. Aceptación

- [ ] Ninguna clase `slate-*` / `indigo-*` ni hex crudo en `Pages/Operations/**` ni `Components/Operations/**` (salvo tokens vía `var(--emp-*)`).
- [ ] `module-ui.css` importado en las cuatro páginas del módulo; sin hoja nueva.
- [ ] El listado se ve como el de Empleados a la misma anchura: mismas alturas de campo (38px), mismo `emp-seg`, mismas métricas 27px, misma paginación.
- [ ] Formulario con índice, tres secciones numeradas, reglas que se desvanecen y panel derecho pegajoso; ningún `Card` con cabecera.
- [ ] La nota de dificultad cambia al teclear minutos y coincide con lo que guarda el backend.
- [ ] Precio editable: `Enter` guarda, `Escape` cancela, error revierte y avisa.
- [ ] Selección múltiple: seleccionar todo, contador correcto, activar/inactivar en una sola petición.
- [ ] Duplicar deja la copia abierta en «Editar» con el nombre sufijado.
- [ ] Modal de creación rápida: sigue devolviendo la operación creada a la referencia y ya no usa colores de Tailwind.
- [ ] Móvil (≤640px): tarjetas, objetivos ≥44px, barra fija inferior, sin scroll horizontal.
- [ ] Sin anillo de foco azul en ningún control del módulo; `:focus-visible` en acento.
- [ ] Iconos: solo Phosphor dentro del módulo.
