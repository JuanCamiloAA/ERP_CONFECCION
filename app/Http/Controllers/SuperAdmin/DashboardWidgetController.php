<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreDashboardWidgetRequest;
use App\Http\Requests\SuperAdmin\UpdateDashboardWidgetRequest;
use App\Http\Requests\SuperAdmin\UpdateDashboardWidgetVisibilityRequest;
use App\Models\Company;
use App\Models\DashboardWidget;
use App\Models\Role;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use App\Services\DashboardBuilder\WidgetQueryException;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardWidgetController extends Controller
{
    public function __construct(protected WidgetQueryBuilder $queryBuilder) {}

    public function index(): Response
    {
        $widgets = DashboardWidget::query()
            ->withCount('visibility')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('SuperAdmin/DashboardWidgets/Index', [
            'widgets' => $widgets,
        ]);
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
        $dashboard_widget->load(['visibility']);

        $companies = Company::query()
            ->select('id', 'name', 'is_active')
            ->orderBy('name')
            ->get();

        $roles = Role::query()
            ->whereNotNull('company_id')
            ->where('guard_name', 'web')
            ->orderBy('display_name')
            ->get(['id', 'company_id', 'name', 'display_name']);

        return Inertia::render('SuperAdmin/DashboardWidgets/Edit', [
            'widget' => $dashboard_widget,
            'availableTables' => $this->availableTablesProp(),
            'availableSessionVariables' => $this->availableSessionVariablesProp(),
            'companies' => $companies,
            'rolesByCompany' => $roles->groupBy('company_id')->map(fn ($group) => $group->values())->all(),
            'visibility' => $dashboard_widget->visibility()->orderBy('position')->get(),
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

        try {
            if ($queryMode === DashboardWidget::QUERY_MODE_SQL) {
                $sql = trim((string) $request->input('raw_sql', ''));
                $data = $this->queryBuilder->executeSql($sql, $companyId, $type, $sessionVariables);
            } elseif ($queryMode === DashboardWidget::QUERY_MODE_BUILDER) {
                $definition = (array) $request->input('query_definition', []);
                $shapeErrors = WidgetQueryBuilder::validateDefinitionShape($definition, $type);
                if ($shapeErrors !== []) {
                    return response()->json(['message' => implode(' ', $shapeErrors)], 422);
                }
                $data = $this->queryBuilder->executeGuided($definition, $companyId, $type, $sessionVariables);
            } else {
                return response()->json(['message' => 'Modo de consulta invalido.'], 422);
            }
        } catch (WidgetQueryException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'No se pudo ejecutar la consulta: '.$e->getMessage()], 422);
        }

        return response()->json($data);
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
            ->route('super-admin.dashboard-widgets.edit', $dashboard_widget)
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
