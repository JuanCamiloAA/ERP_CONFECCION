<?php

namespace App\Http\Controllers;

use App\Services\DashboardStatsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(protected DashboardStatsService $stats) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $companyId = $user->company_id ?? session('active_company_id');

        if (! $companyId && $user->isSuperAdmin()) {
            return Inertia::render('Dashboard/Index', [
                'requireCompany' => true,
                'stats' => null,
            ]);
        }

        $scopedEmployeeId = null;
        if ($user->employee_id && ! $user->isAdmin() && ! $user->isSuperAdmin()) {
            $scopedEmployeeId = $user->employee_id;
        }

        $stats = $this->stats->stats($companyId, $scopedEmployeeId);

        return Inertia::render('Dashboard/Index', [
            'stats' => $stats,
            'requireCompany' => false,
        ]);
    }
}
