<?php

namespace App\Http\Controllers;

use App\Models\DashboardWidget;
use App\Models\Employee;
use App\Models\User;
use App\Services\Dashboard\DashboardService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(protected DashboardService $dashboard) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $productivityDays = (int) $request->input('productivity_days', 30);
        if (! in_array($productivityDays, [7, 30, 90], true)) {
            $productivityDays = 30;
        }

        if ($user->isSuperAdmin()) {
            $focusedCompanyId = TenantContext::superAdminSelectedCompanyId();
            $stats = $this->dashboard->getSuperAdminStats($focusedCompanyId);
            $layoutVariant = $focusedCompanyId !== null ? 'super_admin_focused' : 'super_admin_consolidated';

            return Inertia::render('Dashboard/Index', [
                'variant' => 'super_admin',
                'stats' => $stats,
                'productivity_days' => $productivityDays,
                'requireCompany' => false,
                'customWidgets' => $this->customWidgetsFor($user, $focusedCompanyId),
                'layoutVariant' => $layoutVariant,
                'dashboardLayout' => $this->layoutFor($user, $layoutVariant),
            ]);
        }

        $effectiveCompanyId = TenantContext::effectiveCompanyId($user);
        if (! $effectiveCompanyId) {
            return Inertia::render('Dashboard/Index', [
                'variant' => null,
                'stats' => null,
                'requireCompany' => true,
                'productivity_days' => $productivityDays,
                'customWidgets' => [],
                'layoutVariant' => null,
                'dashboardLayout' => [],
            ]);
        }

        if ($user->employee_id && ! $user->isAdmin()) {
            $employee = Employee::query()
                ->withoutGlobalScopes()
                ->whereKey($user->employee_id)
                ->where('company_id', $effectiveCompanyId)
                ->first();

            if ($employee) {
                $stats = $this->dashboard->getEmployeeStats($employee);

                return Inertia::render('Dashboard/Index', [
                    'variant' => 'employee',
                    'stats' => $stats,
                    'productivity_days' => $productivityDays,
                    'requireCompany' => false,
                    'customWidgets' => $this->customWidgetsFor($user, $effectiveCompanyId),
                    'layoutVariant' => 'employee',
                    'dashboardLayout' => $this->layoutFor($user, 'employee'),
                ]);
            }
        }

        $stats = $this->dashboard->getCompanyAdminStats((int) $effectiveCompanyId, $productivityDays);

        return Inertia::render('Dashboard/Index', [
            'variant' => 'company_admin',
            'stats' => $stats,
            'productivity_days' => $productivityDays,
            'requireCompany' => false,
            'customWidgets' => $this->customWidgetsFor($user, $effectiveCompanyId),
            'layoutVariant' => 'company_admin',
            'dashboardLayout' => $this->layoutFor($user, 'company_admin'),
        ]);
    }

    /**
     * @return list<string>
     */
    /**
     * Filtra entradas del formato antiguo (solo orden, strings) guardadas antes de que el
     * layout pasara a incluir posicion y tamano ({i,x,y,w,h}); si no coinciden con la forma
     * actual se descartan y el frontend arma el layout por defecto para esa variante.
     */
    protected function layoutFor(User $user, string $variant): array
    {
        $layout = (array) $user->dashboard_layout;
        $raw = (array) ($layout[$variant] ?? []);

        return array_values(array_filter($raw, function ($item) {
            return is_array($item)
                && isset($item['i'], $item['x'], $item['y'], $item['w'], $item['h'])
                && is_string($item['i']);
        }));
    }

    /**
     * Metadata liviana de los widgets dinamicos visibles para este usuario/empresa.
     * NO ejecuta las consultas de cada widget aqui (carga perezosa desde el frontend,
     * ver DashboardWidgetDataController).
     *
     * @return list<array<string, mixed>>
     */
    protected function customWidgetsFor(User $user, ?int $effectiveCompanyId): array
    {
        if ($effectiveCompanyId === null) {
            return [];
        }

        $roleIds = $user->roles->pluck('id')->all();

        return DashboardWidget::query()
            ->where('is_active', true)
            ->whereHas('visibility', function ($q) use ($effectiveCompanyId, $roleIds) {
                $q->where('company_id', $effectiveCompanyId)
                    ->where(function ($q2) use ($roleIds) {
                        $q2->whereNull('role_id');
                        if ($roleIds !== []) {
                            $q2->orWhereIn('role_id', $roleIds);
                        }
                    });
            })
            ->with(['visibility' => fn ($q) => $q->where('company_id', $effectiveCompanyId)])
            ->get()
            ->map(fn (DashboardWidget $w) => [
                'id' => $w->id,
                'title' => $w->title,
                'type' => $w->type,
                'refresh_interval_seconds' => $w->refresh_interval_seconds,
                'position' => $w->visibility->first()?->position ?? 0,
            ])
            ->sortBy('position')
            ->values()
            ->all();
    }
}
