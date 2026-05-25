<?php

namespace App\Http\Controllers;

use App\Models\Employee;
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

            return Inertia::render('Dashboard/Index', [
                'variant' => 'super_admin',
                'stats' => $stats,
                'productivity_days' => $productivityDays,
                'requireCompany' => false,
            ]);
        }

        $effectiveCompanyId = TenantContext::effectiveCompanyId($user);
        if (! $effectiveCompanyId) {
            return Inertia::render('Dashboard/Index', [
                'variant' => null,
                'stats' => null,
                'requireCompany' => true,
                'productivity_days' => $productivityDays,
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
                ]);
            }
        }

        $stats = $this->dashboard->getCompanyAdminStats((int) $effectiveCompanyId, $productivityDays);

        return Inertia::render('Dashboard/Index', [
            'variant' => 'company_admin',
            'stats' => $stats,
            'productivity_days' => $productivityDays,
            'requireCompany' => false,
        ]);
    }
}
