<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreDashboardWidgetRequest;
use App\Http\Requests\SuperAdmin\UpdateDashboardWidgetRequest;
use App\Http\Requests\SuperAdmin\UpdateDashboardWidgetVisibilityRequest;
use App\Models\Company;
use App\Models\DashboardWidget;
use App\Models\DashboardWidgetVisibility;
use App\Models\Role;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use App\Services\DashboardBuilder\WidgetQueryException;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardWidgetController extends Controller
{
    public function __construct(protected WidgetQueryBuilder $queryBuilder) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $state = (string) $request->input('state', 'all');
        if (! in_array($state, ['active', 'inactive', 'all'], true)) {
            $state = 'all';
        }

        $type = $request->input('type');
        $type = is_string($type) && $type !== '' ? $type : null;

        // 'any' = con cualquier asignacion, 'none' = sin ninguna, o el id de una empresa.
        $assignment = (string) $request->input('assignment', 'any');
        if ($assignment === '') {
            $assignment = 'any';
        }

        $query = DashboardWidget::query()
            ->withCount('visibility')
            ->with([
                'visibility.company:id,name',
                'visibility.role:id,display_name,name',
            ]);

        $this->applyIndexFilters($query, $search, $state, $type, $assignment);

        $widgets = $query->orderByDesc('id')->paginate(15)->withQueryString();

        $widgets->getCollection()->transform(fn (DashboardWidget $widget) => [
            'id' => $widget->id,
            'name' => $widget->name,
            'title' => $widget->title,
            'type' => $widget->type,
            'query_mode' => $widget->query_mode,
            'query_summary' => $this->querySummary($widget),
            'refresh_interval_seconds' => (int) $widget->refresh_interval_seconds,
            'is_active' => (bool) $widget->is_active,
            'visibility_count' => (int) $widget->visibility_count,
            'assignments' => $this->assignmentsFor($widget),
        ]);

        return Inertia::render('SuperAdmin/DashboardWidgets/Index', [
            'widgets' => $widgets,
            'filters' => [
                'search' => $search,
                'state' => $state,
                'type' => $type,
                'assignment' => $assignment,
            ],
            'metrics' => $this->indexMetrics(),
            'companies' => Company::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    protected function applyIndexFilters(Builder $query, string $search, string $state, ?string $type, string $assignment): void
    {
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('raw_sql', 'like', "%{$search}%")
                    ->orWhere('query_definition', 'like', "%{$search}%");
            });
        }

        if ($state === 'active') {
            $query->where('is_active', true);
        } elseif ($state === 'inactive') {
            $query->where('is_active', false);
        }

        if ($type !== null) {
            $query->where('type', $type);
        }

        if ($assignment === 'none') {
            $query->doesntHave('visibility');
        } elseif ($assignment !== 'any' && ctype_digit($assignment)) {
            $query->whereHas('visibility', fn ($q) => $q->where('company_id', (int) $assignment));
        }
    }

    /**
     * Cifras de cabecera: siempre sobre todos los widgets, nunca sobre la pagina filtrada.
     *
     * @return array<string, int>
     */
    protected function indexMetrics(): array
    {
        $total = DashboardWidget::query()->count();
        $active = DashboardWidget::query()->where('is_active', true)->count();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'assignments' => DashboardWidgetVisibility::query()->count(),
            'companies' => (int) DashboardWidgetVisibility::query()->distinct()->count('company_id'),
            'roles' => (int) DashboardWidgetVisibility::query()->whereNotNull('role_id')->distinct()->count('role_id'),
            'unassigned' => DashboardWidget::query()->doesntHave('visibility')->count(),
        ];
    }

    /**
     * De donde sale el dato, en una linea.
     *
     * El listado no decia que medía cada widget: había que abrir el editor para saber si
     * «Producción del mes» sumaba unidades o pesos. Se arma en el servidor porque las
     * etiquetas viven en `config/dashboard_builder.php`, que la pantalla no recibe.
     */
    protected function querySummary(DashboardWidget $widget): string
    {
        if ($widget->query_mode === DashboardWidget::QUERY_MODE_SQL) {
            $sql = trim(preg_replace('/\s+/', ' ', (string) $widget->raw_sql) ?? '');
            if ($sql === '') {
                return 'SQL sin definir';
            }

            if (preg_match('/\bfrom\s+`?([a-z0-9_]+)`?/i', $sql, $matches) === 1) {
                return 'SELECT … FROM '.$matches[1];
            }

            return mb_strimwidth($sql, 0, 70, '…');
        }

        $definition = (array) ($widget->query_definition ?? []);
        $table = (string) ($definition['table'] ?? '');

        if ($table === '') {
            return 'Consulta sin definir';
        }

        $tableConfig = WidgetQueryBuilder::tableConfig($table) ?? [];
        $parts = [$table];

        $metric = $definition['metric'] ?? null;
        if (is_array($metric) && isset($metric['aggregation'], $metric['column'])) {
            $parts[] = strtoupper((string) $metric['aggregation']).'('.$metric['column'].')';
        }

        $columns = $definition['columns'] ?? [];
        if (is_array($columns) && $columns !== []) {
            $parts[] = count($columns).' '.(count($columns) === 1 ? 'columna' : 'columnas');
        }

        foreach ((array) ($definition['scopes'] ?? []) as $scope) {
            $parts[] = (string) ($tableConfig['scopes'][(string) $scope]['label'] ?? $scope);
        }

        foreach (array_slice((array) ($definition['filters'] ?? []), 0, 2) as $filter) {
            if (! is_array($filter) || ! isset($filter['column'], $filter['operator'])) {
                continue;
            }
            $value = ($filter['value_type'] ?? 'literal') === 'variable'
                ? ':'.$filter['value']
                : (string) ($filter['value'] ?? '');
            $parts[] = trim($filter['column'].' '.$filter['operator'].' '.$value);
        }

        return implode(' · ', $parts);
    }

    /**
     * Quien ve el widget, agrupado por empresa. Una fila con `role_id` nulo aplica a todos
     * los roles de esa empresa y absorbe a las demas.
     *
     * @return array<int, array{company: string, roles_label: string}>
     */
    protected function assignmentsFor(DashboardWidget $widget): array
    {
        return $widget->visibility
            ->groupBy('company_id')
            ->map(function ($rows) {
                $companyName = $rows->first()->company?->name ?? 'Empresa eliminada';
                $allRoles = $rows->contains(fn ($row) => $row->role_id === null);
                $roleCount = $rows->filter(fn ($row) => $row->role_id !== null)->count();

                return [
                    'company' => $companyName,
                    'roles_label' => $allRoles
                        ? 'todos'
                        : $roleCount.' '.($roleCount === 1 ? 'rol' : 'roles'),
                ];
            })
            ->values()
            ->all();
    }

    public function create(): Response
    {
        return Inertia::render('SuperAdmin/DashboardWidgets/Create', [
            'availableTables' => $this->availableTablesProp(),
            'availableSessionVariables' => $this->availableSessionVariablesProp(),
        ]);
    }

    public function store(StoreDashboardWidgetRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', true);
        $data['refresh_interval_seconds'] = $data['refresh_interval_seconds'] ?? 120;
        $data['created_by'] = $request->user()?->id;

        $widget = DashboardWidget::create($data);

        return redirect()
            ->route('super-admin.dashboard-widgets.edit', $widget)
            ->with('success', 'Widget creado. Ahora puedes asignar visibilidad por empresa y rol.');
    }

    public function edit(DashboardWidget $dashboard_widget): Response
    {
        $dashboard_widget->load(['visibility.company:id,name', 'visibility.role:id,display_name,name']);

        return Inertia::render('SuperAdmin/DashboardWidgets/Edit', [
            'widget' => $dashboard_widget,
            'availableTables' => $this->availableTablesProp(),
            'availableSessionVariables' => $this->availableSessionVariablesProp(),
            'assignments' => $this->assignmentsFor($dashboard_widget),
            'visibilityCount' => $dashboard_widget->visibility->count(),
            // El SQL guardado se muestra de entrada; cada «Probar consulta» lo refresca con
            // lo que haya en el formulario.
            'generatedSql' => $this->safeGeneratedSql($dashboard_widget),
        ]);
    }

    /**
     * Pantalla de visibilidad. Sale del editor porque la matriz empresa × rol necesita el
     * ancho completo, y mezclarla con el formulario obligaba a guardar dos cosas distintas
     * desde la misma pantalla sin que se notara que son dos peticiones.
     */
    public function visibility(DashboardWidget $dashboard_widget): Response
    {
        $dashboard_widget->load(['visibility.company:id,name', 'visibility.role:id,display_name,name']);

        $companies = Company::query()
            ->select('id', 'name', 'nit', 'is_active')
            ->withCount('users')
            ->orderBy('name')
            ->get();

        $roles = Role::query()
            ->whereNotNull('company_id')
            ->where('guard_name', 'web')
            ->orderBy('display_name')
            ->get(['id', 'company_id', 'name', 'display_name']);

        return Inertia::render('SuperAdmin/DashboardWidgets/Visibility', [
            'widget' => $dashboard_widget,
            'availableTables' => $this->availableTablesProp(),
            'companies' => $companies,
            'rolesByCompany' => $roles->groupBy('company_id')->map(fn ($group) => $group->values())->all(),
            'visibility' => $dashboard_widget->visibility()->orderBy('position')->get(),
            'assignments' => $this->assignmentsFor($dashboard_widget),
            'querySummary' => $this->querySummary($dashboard_widget),
        ]);
    }

    public function update(UpdateDashboardWidgetRequest $request, DashboardWidget $dashboard_widget): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', true);
        $data['refresh_interval_seconds'] = $data['refresh_interval_seconds'] ?? 120;

        $dashboard_widget->update($data);

        $this->forgetWidgetCache($dashboard_widget);

        return redirect()
            ->route('super-admin.dashboard-widgets.edit', $dashboard_widget)
            ->with('success', 'Widget actualizado.');
    }

    /**
     * Invierte `is_active` desde el listado, sin entrar al editor. No toca la visibilidad:
     * un widget desactivado conserva sus asignaciones para cuando vuelva.
     */
    public function toggleActive(DashboardWidget $dashboard_widget): RedirectResponse
    {
        $dashboard_widget->update(['is_active' => ! $dashboard_widget->is_active]);

        $this->forgetWidgetCache($dashboard_widget);

        return back()->with(
            'success',
            $dashboard_widget->is_active
                ? "Widget \"{$dashboard_widget->title}\" activado."
                : "Widget \"{$dashboard_widget->title}\" desactivado."
        );
    }

    /**
     * Copia definicion y apariencia, nunca la visibilidad: duplicar es el punto de partida
     * de una variante, y heredar quien la ve la publicaria sin querer. Nace inactivo.
     */
    public function duplicate(Request $request, DashboardWidget $dashboard_widget): RedirectResponse
    {
        $copy = $dashboard_widget->replicate([
            'created_by',
            'created_at',
            'updated_at',
        ]);

        $copy->name = $this->uniqueCopyName($dashboard_widget->name);
        $copy->title = $dashboard_widget->title.' (copia)';
        $copy->is_active = false;
        $copy->created_by = $request->user()?->id;
        $copy->save();

        return redirect()
            ->route('super-admin.dashboard-widgets.edit', $copy)
            ->with('success', 'Widget duplicado en borrador (inactivo y sin asignaciones).');
    }

    protected function uniqueCopyName(string $name): string
    {
        $base = $name.'_copia';
        $candidate = $base;
        $suffix = 2;

        while (DashboardWidget::query()->where('name', $candidate)->exists()) {
            $candidate = $base.'_'.$suffix;
            $suffix++;
        }

        return mb_substr($candidate, 0, 150);
    }

    public function destroy(DashboardWidget $dashboard_widget): RedirectResponse
    {
        $this->forgetWidgetCache($dashboard_widget);
        $dashboard_widget->delete();

        return redirect()->route('super-admin.dashboard-widgets.index')->with('success', 'Widget eliminado.');
    }

    /**
     * Previsualiza una consulta SIN guardar nada. Usa la empresa enfocada por el super admin
     * (selector de navbar) como companyId de prueba; si esta en vista consolidada y la tabla
     * exige company_id, se devuelve un 422 con mensaje claro (no un 500).
     */
    public function preview(Request $request): JsonResponse
    {
        $type = (string) $request->input('type', '');
        $queryMode = (string) $request->input('query_mode', '');

        if (! in_array($type, [
            DashboardWidget::TYPE_KPI, DashboardWidget::TYPE_BAR, DashboardWidget::TYPE_LINE,
            DashboardWidget::TYPE_PIE, DashboardWidget::TYPE_TABLE,
        ], true)) {
            return response()->json(['message' => 'Tipo de widget invalido.'], 422);
        }

        $companyId = TenantContext::superAdminSelectedCompanyId();
        $previewUser = $request->user();
        $sessionVariables = [
            'current_user_id' => $previewUser?->id,
            'current_employee_id' => $previewUser?->employee_id,
            'current_company_id' => $companyId,
        ];

        $generatedSql = null;
        $startedAt = microtime(true);

        try {
            if ($queryMode === DashboardWidget::QUERY_MODE_SQL) {
                $sql = trim((string) $request->input('raw_sql', ''));
                $generatedSql = $sql;
                $data = $this->queryBuilder->executeSql($sql, $companyId, $type, $sessionVariables);
            } elseif ($queryMode === DashboardWidget::QUERY_MODE_BUILDER) {
                $definition = (array) $request->input('query_definition', []);
                $shapeErrors = WidgetQueryBuilder::validateDefinitionShape($definition, $type);
                if ($shapeErrors !== []) {
                    return response()->json(['message' => implode(' ', $shapeErrors)], 422);
                }
                $generatedSql = $this->queryBuilder->generatedSql($definition, $type);
                $data = $this->queryBuilder->executeGuided($definition, $companyId, $type, $sessionVariables);
            } else {
                return response()->json(['message' => 'Modo de consulta invalido.'], 422);
            }
        } catch (WidgetQueryException $e) {
            return response()->json(['message' => $e->getMessage(), 'meta' => ['generated_sql' => $generatedSql]], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'No se pudo ejecutar la consulta: '.$e->getMessage()], 422);
        }

        return response()->json($data + [
            'meta' => [
                'rows' => $this->countPreviewRows($data, $type),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'company_label' => $companyId
                    ? (Company::query()->whereKey($companyId)->value('name') ?? 'Empresa seleccionada')
                    : 'Vista consolidada (sin empresa)',
                'generated_sql' => $generatedSql,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function countPreviewRows(array $data, string $type): int
    {
        return match ($type) {
            DashboardWidget::TYPE_KPI => 1,
            DashboardWidget::TYPE_TABLE => count((array) ($data['rows'] ?? [])),
            default => count((array) ($data['labels'] ?? [])),
        };
    }

    /**
     * El SQL de un widget guardado. Devuelve null en vez de reventar cuando la definicion
     * quedo incompleta: la pantalla de edicion tiene que abrirse igual para arreglarla.
     */
    protected function safeGeneratedSql(DashboardWidget $widget): ?string
    {
        if ($widget->query_mode !== DashboardWidget::QUERY_MODE_BUILDER) {
            return null;
        }

        try {
            return $this->queryBuilder->generatedSql((array) $widget->query_definition, $widget->type);
        } catch (\Throwable) {
            return null;
        }
    }

    public function updateVisibility(UpdateDashboardWidgetVisibilityRequest $request, DashboardWidget $dashboard_widget): RedirectResponse
    {
        $rows = (array) $request->validated('visibility', []);

        DB::transaction(function () use ($dashboard_widget, $rows) {
            $dashboard_widget->visibility()->delete();

            foreach ($rows as $index => $row) {
                $dashboard_widget->visibility()->create([
                    'company_id' => $row['company_id'],
                    'role_id' => $row['role_id'] ?? null,
                    'position' => $row['position'] ?? $index,
                ]);
            }
        });

        $this->forgetWidgetCache($dashboard_widget);

        return redirect()
            ->route('super-admin.dashboard-widgets.visibility', $dashboard_widget)
            ->with('success', 'Visibilidad actualizada.');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function availableTablesProp(): array
    {
        $tables = [];
        foreach (WidgetQueryBuilder::tables() as $key => $config) {
            $tables[] = [
                'key' => $key,
                'label' => $config['label'] ?? $key,
                'has_company_scope' => (bool) ($config['has_company_scope'] ?? false),
                'scopes' => collect($config['scopes'] ?? [])
                    ->map(fn ($scope, $scopeKey) => [
                        'key' => $scopeKey,
                        'label' => $scope['label'] ?? $scopeKey,
                        'help' => $scope['help'] ?? null,
                    ])
                    ->values()
                    ->all(),
                'columns' => collect($config['columns'] ?? [])
                    ->map(fn ($col, $colKey) => [
                        'key' => $colKey,
                        'label' => $col['label'] ?? $colKey,
                        'type' => $col['type'] ?? 'string',
                        'aggregatable' => (bool) ($col['aggregatable'] ?? false),
                        'groupable' => (bool) ($col['groupable'] ?? false),
                    ])
                    ->values()
                    ->all(),
            ];
        }

        return $tables;
    }

    /**
     * @return array<int, array<string, string>>
     */
    protected function availableSessionVariablesProp(): array
    {
        $variables = [];
        foreach (WidgetQueryBuilder::sessionVariables() as $key => $config) {
            $variables[] = [
                'key' => $key,
                'label' => $config['label'] ?? $key,
            ];
        }

        return $variables;
    }

    /**
     * La clave de cache incluye company_id Y user_id (los widgets con variables de sesion
     * varian por persona), asi que no se puede reconstruir una a una. Con el driver 'database'
     * se borran por coincidencia directa en la tabla de cache; con otros drivers se confia en el
     * TTL corto (refresh_interval_seconds) del widget para autolimpiarse.
     */
    protected function forgetWidgetCache(DashboardWidget $widget): void
    {
        if (config('cache.default') !== 'database') {
            return;
        }

        try {
            DB::table(config('cache.stores.database.table', 'cache'))
                ->where('key', 'like', '%dashboard_widget:'.$widget->id.':%')
                ->delete();
        } catch (\Throwable) {
            // best-effort: si falla, el TTL corto del widget igual limpia el dato stale.
        }
    }
}
