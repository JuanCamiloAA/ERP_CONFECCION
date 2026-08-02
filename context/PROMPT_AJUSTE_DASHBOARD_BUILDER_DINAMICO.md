# AJUSTE — Dashboard: constructor dinámico de cockpits/gráficos para Super Admin
## Prompt para Claude Opus — Reestructuración controlada del módulo Dashboard

---

> **USO:** El proyecto (Taller confección, Laravel 12, Inertia, React/TS, multi-tenant por `company_id`, roles/permisos vía Spatie Permission) **ya existe**. Pega este documento completo en una sesión de Claude Code / Claude Opus dentro del repo. Es una funcionalidad **grande y sensible** (el super admin podrá consultar datos de cualquier empresa desde un query builder) — léela completa antes de empezar a codear, respeta el orden de implementación de la sección 12, y **no** sacrifiques las salvaguardas de multi-tenencia de la sección 2 por velocidad.

---

## 0. OBJETIVO DE NEGOCIO

Hoy el Dashboard (`app/Http/Controllers/DashboardController.php` + `app/Services/Dashboard/DashboardService.php`) es **100% hard-coded**: tres variantes fijas (`SuperAdminOverview.tsx`, `CompanyAdminOverview.tsx`, `EmployeeOverview.tsx`) que consumen un shape de datos PHP fijo. No existe ningún concepto de widget configurable, query builder ni visibilidad granular.

Se requiere que el **super admin** pueda, desde una nueva sección de administración:

1. **Elegir una tabla de la base de datos** (de una lista blanca controlada, no cualquier tabla del sistema) y **construir una consulta** sobre ella: columnas, filtros, agrupación y agregación (SUM/COUNT/AVG/MIN/MAX) — modo **guiado** por defecto, sin escribir SQL.
2. Alternativamente, para casos que el modo guiado no cubra, usar un **modo SQL avanzado** (solo `SELECT`, con salvaguardas — ver sección 2.4).
3. Con esa consulta, **construir un widget visual**: tarjeta KPI, gráfico de barras, de líneas, de torta, o tabla de datos.
4. **Asignar visibilidad** a cada widget de forma explícita: qué **empresas** y qué **roles** dentro de esas empresas lo verán en su Dashboard. Un widget puede estar asignado a varias combinaciones empresa+rol.
5. Los usuarios de las empresas/roles seleccionados verán esos widgets dentro de su Dashboard normal, en una sección adicional junto a (no reemplazando) las métricas actuales del negocio.

**Decisión de diseño — "reestructurar sin romper":** el usuario autorizó reestructurar completamente el módulo si hace falta para evitar bugs. La recomendación de este documento es **no reescribir la lógica de negocio ya probada** de `DashboardService` (producción pendiente de pago, nómina, productividad, etc. — son cálculos financieros reales y sensibles), sino:
   - **Reestructurar la organización del código** del módulo (separar en servicios más pequeños, tipos compartidos, componentes reutilizables) donde aporte claridad.
   - **Añadir** el sistema de widgets dinámicos como una capa nueva y independiente que convive con las tres variantes actuales.
   
   Si al implementar se detecta una razón concreta para tocar `DashboardService`, documentarla, pero el criterio por defecto es "aditivo, no destructivo" sobre los cálculos financieros existentes.

---

## 1. RIESGOS QUE ESTE DISEÑO DEBE MITIGAR (leer antes de codear)

Investigación del código actual confirma:

- El `CompanyScope` global (`app/Models/Scopes/CompanyScope.php`) **no aplica a todas las tablas**: solo los modelos que declaran `#[ScopedBy([CompanyScope::class])]` lo tienen (`Production`, `Employee`, `Payroll`, `Reference`, `Operation`, `Advance`, `Expense`, etc.). Tablas como `users`, `roles`, `permissions`, `companies` **no tienen `company_id`** o son intencionalmente globales.
- `DashboardService` ya bypasea el scope automático con `->withoutGlobalScopes()` y filtra `company_id` **manualmente y explícitamente** en cada query — es el patrón correcto a replicar: **nunca confiar en el scope automático** dentro del motor de consultas dinámico.
- Existe migración defensiva `2026_05_12_120000_add_company_id_to_productions_if_missing.php`, señal de que históricamente ha habido inconsistencias de `company_id` — el motor de consultas debe **verificar en runtime** (no asumir) si una tabla tiene columna `company_id`.
- El super admin, en "vista consolidada" (`TenantContext::superAdminSelectedCompanyId() === null`), puede ver datos de **todas** las empresas sin filtro — correcto para él al construir/previsualizar un widget, pero **catastrófico** si esa misma consulta se ejecuta sin filtro para un usuario final de una empresa.

**Regla de oro para todo el diseño:** la consulta de un widget se define **una sola vez** por el super admin, pero se **ejecuta muchas veces**, una por cada empresa que lo vea, y el `company_id` de filtrado en cada ejecución debe ser **siempre el de la empresa del usuario que está viendo el dashboard en ese momento** — nunca un valor guardado en la definición del widget, nunca confiado del cliente/frontend.

---

## 2. CAPA DE SEGURIDAD DE CONSULTAS (núcleo del sistema — implementar primero)

### 2.1 Lista blanca de tablas y columnas

Crear `config/dashboard_builder.php`:

```php
<?php

return [
    'tables' => [
        'productions' => [
            'label' => 'Producción',
            'model' => \App\Models\Production::class,
            'has_company_scope' => true,
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer'],
                'quantity' => ['label' => 'Cantidad', 'type' => 'number', 'aggregatable' => true],
                'total_value' => ['label' => 'Valor total', 'type' => 'currency', 'aggregatable' => true],
                'created_at' => ['label' => 'Fecha', 'type' => 'date', 'groupable' => true],
                'employee_id' => ['label' => 'Empleado', 'type' => 'integer', 'groupable' => true],
                'reference_id' => ['label' => 'Referencia', 'type' => 'integer', 'groupable' => true],
                'operation_id' => ['label' => 'Operación', 'type' => 'integer', 'groupable' => true],
                // ... resto de columnas expuestas explícitamente, NUNCA "SELECT *"
            ],
        ],
        'payrolls' => [ /* análogo */ ],
        'employees' => [ /* análogo */ ],
        'advances' => [ /* análogo */ ],
        'expenses' => [ /* análogo */ ],
        // Ampliar según necesidad real del negocio; agregar tabla = agregar entrada aquí.
        // NO incluir aquí: users, roles, permissions, model_has_roles, personal_access_tokens,
        // password_reset_tokens, sessions, jobs, failed_jobs, migrations, ni cualquier tabla
        // con credenciales, tokens o datos de autenticación.
    ],
];
```

Reglas:
- **Cualquier tabla no listada aquí es inaccesible**, tanto en modo guiado como en el validador del modo SQL.
- **Cualquier columna no listada dentro de una tabla es inaccesible** en modo guiado.
- `has_company_scope`: si es `true`, el motor **exige** filtrar por `company_id` en cada ejecución (ver 2.2). Si es `false` (ej. una futura tabla global), el widget solo puede asignarse a visibilidad de super admin, nunca a una empresa/rol específico (ver 2.4 y la migración de `dashboard_widget_visibility`).

### 2.2 Servicio ejecutor — modo guiado

Crear `app/Services/DashboardBuilder/WidgetQueryBuilder.php`:

- Recibe el `query_definition` (JSON validado, ver forma en 3.2) y un `?int $companyId` (empresa para la que se ejecuta; `null` solo permitido cuando quien previsualiza es super admin en vista consolidada).
- **Nunca interpola strings del usuario directamente en SQL.** Cada nombre de tabla/columna del `query_definition` se valida contra `config('dashboard_builder.tables')` con `in_array`/`array_key_exists` **antes** de pasarlo a `DB::table()->select()/where()/groupBy()`. Si algo no está en la whitelist, lanzar excepción de validación — nunca ejecutar.
- Construye con `Illuminate\Database\Query\Builder` (`DB::table($table)`), **no** Eloquent directo, para tener control total sobre las columnas seleccionadas.
- Si `has_company_scope` de la tabla es `true`: **siempre** añade `->where('company_id', $companyId)`. Si `$companyId` es `null` en este caso, lanzar excepción (nunca ejecutar sin filtro salvo el caso explícito de super admin en vista consolidada, y solo para preview, nunca para render de un widget asignado a una empresa concreta).
- Agregaciones (`sum/count/avg/min/max`) solo sobre columnas marcadas `aggregatable: true`. Agrupación solo sobre columnas marcadas `groupable: true`.
- Aplica `limit` máximo duro (ej. 500 filas) independientemente de lo que pida la definición, para evitar payloads gigantes.

### 2.3 Servicio ejecutor — modo SQL avanzado

Mismo servicio (o clase hermana `RawSqlWidgetExecutor`), reglas adicionales:

- Validar con regex que el texto, una vez trimeado, **empieza por `SELECT`** (case-insensitive) y no contiene `;` seguido de más contenido (una sola sentencia), ni palabras clave de escritura/DDL: `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|REPLACE|CALL|EXEC` (regex con límites de palabra, case-insensitive). Rechazar si aparece cualquiera.
- Ejecutar **siempre** con `DB::select($sql, $bindings)` (consulta parametrizada, nunca concatenación), nunca `DB::unprepared` ni `DB::statement`.
- **Regla de tenencia para SQL avanzado:** si el widget en modo SQL va a asignarse a visibilidad de una empresa/rol específico (no solo super admin), el SQL **debe contener el placeholder literal `:company_id`** en su texto (validar con `str_contains($sql, ':company_id')` antes de permitir guardar esa asignación). Al ejecutar, siempre bindear `['company_id' => $companyId]`. Si el super admin intenta asignar a una empresa un widget SQL que no referencia `:company_id`, bloquear el guardado con mensaje: *"Esta consulta no filtra por empresa (falta `:company_id`); solo puede usarse en la vista consolidada del super admin."*
- Considerar (documentar como mejora recomendada, no bloqueante para el MVP) ejecutar el modo SQL contra una conexión de base de datos de solo lectura (`config/database.php`, nueva conexión con un usuario MySQL `SELECT`-only) como defensa adicional.

### 2.4 Consecuencia en el modelo de visibilidad

Al guardar una fila en `dashboard_widget_visibility` (ver 3.1) con `company_id` no nulo:
- Si `query_mode = builder`: validar que la tabla tenga `has_company_scope = true` en `config/dashboard_builder.php`.
- Si `query_mode = sql`: validar que `raw_sql` contenga `:company_id` (ver 2.3).
- Si ninguna condición se cumple, rechazar la asignación con 422 y mensaje explicativo. Esta validación va en el `FormRequest` de guardado de visibilidad, no solo en el frontend.

---

## 3. MODELO DE DATOS

### 3.1 Migraciones nuevas

```php
// database/migrations/xxxx_create_dashboard_widgets_table.php
Schema::create('dashboard_widgets', function (Blueprint $table) {
    $table->id();
    $table->string('name'); // nombre interno para el super admin
    $table->string('title'); // título mostrado a los usuarios finales
    $table->text('description')->nullable();
    $table->enum('type', ['kpi', 'bar', 'line', 'pie', 'table']);
    $table->enum('query_mode', ['builder', 'sql']);
    $table->json('query_definition')->nullable(); // forma en 3.2, requerido si query_mode = builder
    $table->text('raw_sql')->nullable(); // requerido si query_mode = sql
    $table->json('chart_config')->nullable(); // mapeo de ejes, formato moneda, colores, etc.
    $table->unsignedInteger('refresh_interval_seconds')->default(120);
    $table->boolean('is_active')->default(true);
    $table->foreignId('created_by')->constrained('users')->nullOnDelete();
    $table->timestamps();
});

// database/migrations/xxxx_create_dashboard_widget_visibility_table.php
Schema::create('dashboard_widget_visibility', function (Blueprint $table) {
    $table->id();
    $table->foreignId('dashboard_widget_id')->constrained()->cascadeOnDelete();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('role_id')->nullable()->constrained('roles')->cascadeOnDelete(); // null = todos los roles de esa empresa
    $table->unsignedInteger('position')->default(0); // orden dentro del dashboard destino
    $table->timestamps();
    $table->unique(['dashboard_widget_id', 'company_id', 'role_id']);
});
```

Nota: **no** se crea una tabla separada de "cockpits". Un "cockpit" en este diseño es, simplemente, el conjunto de widgets visibles para una combinación empresa+rol, ordenados por `position` — evita una capa de indirección innecesaria. Si más adelante se requiere agrupar widgets en pestañas/secciones con nombre propio, se puede añadir una columna `group_label` a `dashboard_widget_visibility` (fuera de alcance de este MVP).

### 3.2 Forma del `query_definition` (modo guiado)

```json
{
  "table": "productions",
  "metric": { "column": "quantity", "aggregation": "sum" },
  "group_by": { "column": "created_at", "granularity": "day" },
  "filters": [
    { "column": "is_active", "operator": "=", "value": true }
  ],
  "order_by": { "column": "value", "direction": "desc" },
  "limit": 50
}
```

- `metric`: obligatorio salvo `type = table` (donde en su lugar se define `columns: string[]` con las columnas a listar tal cual).
- `group_by`: opcional; si el widget es `kpi`, no debe tener `group_by` (un KPI es un solo número).
- `granularity` (solo si `group_by.column` es de tipo `date`): `day | week | month`.
- `filters`: array de condiciones simples (columna whitelisted + operador de un set cerrado `= != > >= < <= like` + valor). Sin subconsultas, sin lógica OR anidada en el MVP (documentar como posible fase 2).

### 3.3 Modelos Eloquent

- `App\Models\DashboardWidget` — `$fillable` = columnas de la tabla, `casts`: `query_definition` y `chart_config` a `array`, `is_active` a `boolean`. Relación `visibility(): HasMany` a `DashboardWidgetVisibility`. Método `isVisibleFor(User $user): bool` que resuelve `company_id`/`role` efectivos del usuario contra `visibility()`.
- `App\Models\DashboardWidgetVisibility` — `belongsTo` a `DashboardWidget`, `Company`, `Role` (nullable).

Estos modelos **no** llevan `#[ScopedBy([CompanyScope::class])]` (son administrados solo por super admin, sin scope de empresa propio — su `company_id` vive en la tabla de visibilidad, no en el widget).

---

## 4. BACKEND — SERVICIOS Y CONTROLADORES

### 4.1 `app/Services/DashboardBuilder/WidgetQueryBuilder.php`

Ver sección 2.2/2.3. Método público principal:

```php
public function execute(DashboardWidget $widget, ?int $companyId): array
{
    // valida modo, construye y ejecuta, retorna forma normalizada:
    // ['labels' => [...], 'series' => [...]] para bar/line/pie
    // ['value' => number] para kpi
    // ['columns' => [...], 'rows' => [...]] para table
}
```

### 4.2 `app/Http/Controllers/SuperAdmin/DashboardWidgetController.php`

CRUD estándar (`index`, `create`, `store`, `edit`, `update`, `destroy`), siguiendo el patrón de `MembershipPlanController.php` (resource simple). Además:

- `POST /super-admin/dashboard-widgets/preview` → recibe `query_mode`, `query_definition`/`raw_sql`, `type`, `chart_config` **sin guardar nada**, ejecuta con `WidgetQueryBuilder` usando `TenantContext::superAdminSelectedCompanyId()` como `companyId` de prueba (o `null` para consolidado si la tabla lo permite), devuelve JSON para pintar el preview en vivo del formulario. Debe capturar excepciones de la capa de seguridad y devolverlas como 422 con mensaje claro (no 500).
- `PUT /super-admin/dashboard-widgets/{widget}/visibility` → reemplaza el set de filas en `dashboard_widget_visibility` para ese widget (payload: array de `{company_id, role_id, position}`), validando 2.4 fila por fila.

### 4.3 `app/Http/Controllers/DashboardController.php` (extender, no reescribir)

En `index()`, además de la variante actual (`super_admin`/`company_admin`/`employee`), añadir a las props de Inertia:

```php
'customWidgets' => DashboardWidget::query()
    ->where('is_active', true)
    ->whereHas('visibility', function ($q) use ($user, $effectiveCompanyId) {
        $q->where('company_id', $effectiveCompanyId)
          ->where(function ($q2) use ($user) {
              $q2->whereNull('role_id')->orWhereIn('role_id', $user->roles->pluck('id'));
          });
    })
    ->with(['visibility' => fn ($q) => $q->where('company_id', $effectiveCompanyId)])
    ->get()
    ->map(fn ($w) => [
        'id' => $w->id, 'title' => $w->title, 'type' => $w->type,
        'refresh_interval_seconds' => $w->refresh_interval_seconds,
        'position' => $w->visibility->first()?->position ?? 0,
    ])
    ->sortBy('position')
    ->values(),
```

Solo metadata liviana — **no** ejecutar aquí las queries de cada widget (ver 4.4, carga perezosa desde el frontend).

### 4.4 Endpoint de datos de un widget (consumo, cualquier usuario autorizado)

```php
Route::get('/dashboard/widgets/{widget}/data', [DashboardWidgetDataController::class, 'show'])
    ->name('dashboard.widgets.data')
    ->middleware('permission:dashboard.index.view');
```

`DashboardWidgetDataController::show(DashboardWidget $widget)`:
- Resuelve `companyId = TenantContext::effectiveCompanyId($request->user())`.
- Verifica `$widget->isVisibleFor($request->user())`; si no, `abort(403)`.
- Cachea con `Cache::remember("dashboard_widget:{$widget->id}:company:{$companyId}", $widget->refresh_interval_seconds, fn () => $this->queryBuilder->execute($widget, $companyId))`, mismo patrón de TTL corto que ya usa `DashboardService`.
- Devuelve JSON con la forma normalizada de 4.1.

---

## 5. PERMISOS

En `app/Helpers/PermissionHelper.php::getPermissionMatrix()`, añadir un módulo nuevo:

```php
'dashboard_builder' => [
    'display' => 'Constructor de Dashboards',
    'icon' => 'Cog6ToothIcon',
    'order' => 91,
    'super_admin_only' => true,
    'pages' => [
        'index' => [
            'display' => 'Widgets de Dashboard',
            'route' => 'super-admin.dashboard-widgets.index',
            'actions' => ['view', 'create', 'edit', 'delete'],
        ],
    ],
],
```

Sigue el mismo patrón que `companies` y `payroll_periodicities` (líneas ~172-193 de `PermissionHelper.php`), marcados igual con `super_admin_only`. No se requiere permiso nuevo para que un usuario **consuma** widgets en su Dashboard — eso ya lo protege `dashboard.index.view` (permiso existente) más la verificación de `isVisibleFor()` en el backend.

---

## 6. RUTAS

En `routes/web.php`, dentro del grupo ya existente `Route::middleware('super.admin')->prefix('super-admin')->name('super-admin.')` (líneas 162-190), añadir:

```php
Route::resource('dashboard-widgets', DashboardWidgetController::class);
Route::post('dashboard-widgets/preview', [DashboardWidgetController::class, 'preview'])->name('dashboard-widgets.preview');
Route::put('dashboard-widgets/{dashboardWidget}/visibility', [DashboardWidgetController::class, 'updateVisibility'])->name('dashboard-widgets.visibility');
```

Fuera de ese grupo, junto a la ruta actual `dashboard` (línea ~43-45 de `routes/web.php`), añadir:

```php
Route::get('/dashboard/widgets/{widget}/data', [DashboardWidgetDataController::class, 'show'])
    ->name('dashboard.widgets.data')
    ->middleware('permission:dashboard.index.view');
```

No tocar ninguna ruta existente.

---

## 7. FRONTEND — CONSTRUCTOR (SUPER ADMIN)

Nuevas páginas bajo `resources/js/Pages/SuperAdmin/DashboardWidgets/`, siguiendo el kit de UI ya usado por `MembershipPlans/*` y `DataImports/*` (`Table/TableHead/TableBody/TableRow/TableCell` de `@/Components/UI/Table`, `PageHeader`, `Pagination`, `ConfirmDialog`, `Badge`, `Button`, `Modal`):

- **`Index.tsx`** — listado de widgets (nombre, tipo, modo de consulta, activo/inactivo, cantidad de asignaciones de visibilidad), acciones editar/eliminar/activar-desactivar.
- **`Create.tsx` / `Edit.tsx`** — formulario con:
  1. Datos básicos: `name`, `title`, `description`, `type` (Select: KPI/Barras/Líneas/Torta/Tabla).
  2. Selector de `query_mode` (guiado/SQL) — un `Switch` o tabs.
  3. **Modo guiado:** `Select` de tabla (desde una nueva prop `availableTables` que el controlador arma leyendo `config('dashboard_builder.tables')`), que al cambiar recarga dinámicamente los `Select` dependientes de columnas/filtros/agrupación (todo poblado desde la misma prop, sin llamadas adicionales al backend). Componente sugerido: `resources/js/Components/DashboardBuilder/GuidedQueryForm.tsx`.
  4. **Modo SQL:** `Textarea` monoespaciado para `raw_sql`, con nota visible de las restricciones de la sección 2.3 y, si hay al menos una asignación de visibilidad a empresa, aviso de que el SQL debe incluir `:company_id`.
  5. **Preview en vivo:** botón "Probar consulta" que llama a `POST super-admin.dashboard-widgets.preview` vía `axios` (mismo patrón que el prompt de operaciones — no usar `router.post` de Inertia aquí para no perder el estado del formulario) y renderiza el resultado con el mismo `DynamicChart` que verán los usuarios finales (sección 8.1).
  6. `chart_config`: opciones simples según `type` (formato moneda sí/no, color, etiquetas de ejes).
  7. **Visibilidad:** selector de pares empresa+rol — lista de empresas (`Select` multi o checkboxes) y, por cada empresa marcada, sub-selector de roles de esa empresa (`Role::forCompany($companyId)`) con opción "Todos los roles". Guardar vía `PUT dashboard-widgets.visibility`.

Todas las páginas envueltas por `<Can permission="dashboard_builder.index.*">` según la acción (ya cubierto también por el middleware `super.admin` de las rutas).

---

## 8. FRONTEND — CONSUMO EN EL DASHBOARD DE EMPRESAS/ROLES

### 8.1 Componente genérico `resources/js/Components/Dashboard/DynamicChart.tsx`

Basado en `recharts` (única librería de charts del proyecto, ya usada en `CompanyAdminOverview.tsx` y `EmployeeOverview.tsx`):

```ts
interface DynamicChartProps {
    type: 'kpi' | 'bar' | 'line' | 'pie' | 'table';
    data: WidgetDataPayload; // forma normalizada de 4.1
    config?: Record<string, unknown>; // chart_config del widget
    title: string;
}
```

- `kpi`: reutilizar visualmente el mismo componente `StatCard` (`resources/js/Components/UI/StatCard.tsx`) ya usado en los tres Overview actuales, para mantener consistencia visual.
- `bar`/`line`/`pie`: `ResponsiveContainer` + el componente de `recharts` correspondiente, mismo estilo de `Tooltip`/`CartesianGrid` que ya usa `CompanyAdminOverview.tsx`.
- `table`: reutilizar `Table/TableHead/TableBody/TableRow/TableCell` de `@/Components/UI/Table`.

### 8.2 Nuevo componente contenedor `resources/js/Components/Dashboard/CustomWidgetGrid.tsx`

- Recibe la lista `customWidgets` (metadata liviana, prop de `DashboardController::index`, ver 4.3).
- Por cada widget, renderiza una `Card` con `title`, estado de carga, y dispara `axios.get(route('dashboard.widgets.data', widget.id))` en un `useEffect` al montar (y opcionalmente un `setInterval` de `refresh_interval_seconds * 1000` para refrescar automáticamente, con `clearInterval` en el cleanup).
- Maneja error (403/500) mostrando un estado de error discreto en esa tarjeta puntual, **sin** romper el resto del dashboard (aislar el error por widget — un widget mal configurado no debe tumbar la página).

### 8.3 Integración en `Index.tsx` / Overviews

En `resources/js/Pages/Dashboard/Index.tsx`, pasar la nueva prop `customWidgets` a las tres variantes (`SuperAdminOverview.tsx`, `CompanyAdminOverview.tsx`, `EmployeeOverview.tsx`), y en cada una renderizar `<CustomWidgetGrid widgets={customWidgets} />` en una sección nueva, claramente separada ("Informes personalizados"), **debajo** de las métricas fijas existentes — no reemplazarlas. Si `customWidgets` está vacío, no mostrar la sección (sin `EmptyState` ruidoso).

Actualizar `resources/js/Pages/Dashboard/dashboard-types.ts` con los tipos nuevos (`CustomWidgetMeta`, `WidgetDataPayload`).

---

## 9. CACHÉ Y RENDIMIENTO

- Cachear el resultado de cada widget por `(widget_id, company_id)` con TTL = `refresh_interval_seconds` del widget (default 120s), igual patrón que `DashboardService` (`Cache::remember`).
- Invalidar la caché de un widget específico al editarlo (`update`) — `Cache::forget` por cada `company_id` con visibilidad activa, o usar un prefijo/tag de caché si el driver lo soporta.
- `limit` duro de filas (sección 2.2) para evitar payloads y renders pesados en el frontend.

---

## 10. NO ROMPER LO EXISTENTE — CHECKLIST DE REGRESIÓN

- [ ] `SuperAdminOverview.tsx`, `CompanyAdminOverview.tsx`, `EmployeeOverview.tsx` siguen mostrando exactamente las mismas métricas de negocio que hoy (conteos, producción pendiente, nómina, productividad, etc.), sin cambios de cálculo.
- [ ] `DashboardService.php` no pierde ningún método ni cambia el shape de datos que ya consumen esas tres páginas (salvo reorganización interna de código que no altere resultados).
- [ ] Rutas, permisos y middlewares existentes (`dashboard.index.view`, `super.admin`, `permission:xxx`) siguen funcionando igual.
- [ ] El resto de módulos (`References`, `Operations`, `Employees`, etc.) no se ven afectados por las nuevas tablas/migraciones.

---

## 11. PRUEBAS MANUALES (CHECKLIST — énfasis en fuga de datos entre empresas)

- [ ] Como super admin, crear un widget guiado sobre `productions` (SUM de `quantity` agrupado por día, últimos 30 días), previsualizarlo con distintas empresas seleccionadas en "vista enfocada" — los números deben cambiar según la empresa enfocada.
- [ ] Asignar ese widget a **Empresa A + rol Admin** únicamente. Iniciar sesión como admin de **Empresa B**: el widget **no debe aparecer** en su Dashboard.
- [ ] Iniciar sesión como admin de **Empresa A**: el widget aparece y sus números corresponden **solo** a datos de Empresa A (comparar contra una consulta manual en BD).
- [ ] Intentar guardar un widget en modo SQL sin `:company_id` y asignarlo a una empresa: debe rechazarse con el mensaje de la sección 2.3.
- [ ] Intentar guardar un widget en modo SQL con una sentencia `UPDATE`/`DELETE`/`; DROP TABLE`: debe rechazarse antes de ejecutar nada.
- [ ] Intentar (manipulando el payload, ej. desde devtools) definir un `query_definition` con una tabla no listada en `config/dashboard_builder.php` (ej. `users`): debe rechazarse en backend con 422, incluso si el frontend no lo hubiera permitido.
- [ ] Widget tipo `table` con más de 500 filas resultado: confirmar que se trunca al límite duro.
- [ ] Desactivar (`is_active = false`) un widget: desaparece de todos los dashboards donde estaba asignado, sin borrar sus datos de configuración.
- [ ] Eliminar un widget: se eliminan en cascada sus filas de `dashboard_widget_visibility` (verificar `cascadeOnDelete`).
- [ ] Widget con consulta que falla en runtime (ej. columna eliminada de una tabla real): la tarjeta muestra error aislado, el resto del dashboard sigue funcionando.
- [ ] `php artisan migrate` y `npm run build` sin errores.

---

## 12. ORDEN DE IMPLEMENTACIÓN

1. `config/dashboard_builder.php` (whitelist) + migraciones (`dashboard_widgets`, `dashboard_widget_visibility`) + modelos.
2. `WidgetQueryBuilder` (modo guiado) con tests manuales directos vía Tinker antes de exponer UI.
3. Modo SQL avanzado + validaciones de la sección 2.3.
4. `DashboardWidgetController` (CRUD + preview + visibility) + permisos + rutas super-admin.
5. Frontend super-admin: `Index/Create/Edit` + `GuidedQueryForm` + preview en vivo.
6. `DashboardWidgetDataController` (consumo) + caché.
7. `DynamicChart` + `CustomWidgetGrid` + integración en `Dashboard/Index.tsx` y los tres Overview.
8. Checklist de regresión (sección 10) y pruebas de fuga de datos (sección 11) antes de dar por cerrada la tarea.

---

## 13. INSTRUCCIÓN FINAL

Implementa de forma **incremental**, validando cada paso del orden de la sección 12 antes de avanzar al siguiente. La prioridad absoluta es que **ningún usuario de una empresa pueda ver datos de otra empresa** a través de un widget — ante cualquier duda de diseño, elige siempre la opción más restrictiva (bloquear/no mostrar) en vez de la más permisiva. Si algún nombre de componente UI, columna de tabla o modelo difiere ligeramente de lo asumido aquí, ajusta a lo real presente en el código, manteniendo la semántica y las salvaguardas descritas — no elimines ninguna validación de tenencia por conveniencia.

Al terminar, entrega la lista de archivos modificados/creados y corre:

```bash
php artisan migrate
npm run build
```

---

*Documento: Dashboard — constructor dinámico de cockpits/widgets con visibilidad por empresa y rol — Agosto 2026*
