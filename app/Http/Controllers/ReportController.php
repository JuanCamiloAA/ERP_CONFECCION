<?php

namespace App\Http\Controllers;

use App\Models\Payroll;
use App\Services\ProductionReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function production(Request $request, ProductionReportService $service): Response
    {
        $user = $request->user();
        $companyId = $user->company_id ?? session('active_company_id');

        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        return Inertia::render('Reports/Production', [
            'filters' => ['start' => $start, 'end' => $end],
            'summary' => $service->summary($start, $end, $companyId),
            'byEmployee' => $service->byEmployee($start, $end, $companyId),
            'byReference' => $service->byReference($start, $end, $companyId),
            'byOperation' => $service->byOperation($start, $end, $companyId),
            'dailySeries' => $service->dailySeries($start, $end, $companyId),
        ]);
    }

    public function payroll(Request $request): Response
    {
        $year = (int) $request->input('year', now()->year);

        $payrolls = Payroll::query()
            ->with('payrollEmployees:id,payroll_id,net_payment,production_total,advances_discount')
            ->whereYear('period_start', $year)
            ->orderByDesc('period_start')
            ->get();

        $summary = [
            'total_payrolls' => $payrolls->count(),
            'total_amount' => (float) $payrolls->sum('total_amount'),
            'total_paid' => (float) $payrolls->where('status', Payroll::STATUS_PAID)->sum('total_amount'),
            'total_pending' => (float) $payrolls->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])->sum('total_amount'),
        ];

        return Inertia::render('Reports/Payroll', [
            'filters' => ['year' => $year],
            'summary' => $summary,
            'payrolls' => $payrolls,
        ]);
    }
}
