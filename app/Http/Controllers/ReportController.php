<?php

namespace App\Http\Controllers;

use App\Models\Payroll;
use App\Services\ProductionReportService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function production(Request $request, ProductionReportService $service): Response
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        $byEmployee = $service->byEmployee($start, $end, $companyId);
        $byReference = $service->byReference($start, $end, $companyId);
        $byOperation = $service->byOperation($start, $end, $companyId);

        return Inertia::render('Reports/Production', [
            'filters' => ['start' => $start, 'end' => $end],
            'summary' => $service->summary($start, $end, $companyId),
            'byEmployee' => $this->paginateCollection($byEmployee, $request, 'emp_page'),
            'byReference' => $this->paginateCollection($byReference, $request, 'ref_page'),
            'byOperation' => $this->paginateCollection($byOperation, $request, 'op_page'),
            'dailySeries' => $service->dailySeries($start, $end, $companyId),
        ]);
    }

    public function payroll(Request $request): Response
    {
        $year = (int) $request->input('year', now()->year);

        $base = Payroll::query()->whereYear('period_start', $year);

        $summary = [
            'total_payrolls' => (clone $base)->count(),
            'total_amount' => (float) (clone $base)->sum('total_amount'),
            'total_paid' => (float) (clone $base)->where('status', Payroll::STATUS_PAID)->sum('total_amount'),
            'total_pending' => (float) (clone $base)->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])->sum('total_amount'),
        ];

        $chartPayrolls = (clone $base)->orderByDesc('period_start')->get(['id', 'name', 'total_amount']);

        $payrolls = (clone $base)->orderByDesc('period_start')->paginate(15)->withQueryString();

        return Inertia::render('Reports/Payroll', [
            'filters' => ['year' => $year],
            'summary' => $summary,
            'chartPayrolls' => $chartPayrolls,
            'payrolls' => $payrolls,
        ]);
    }

    protected function paginateCollection(Collection $items, Request $request, string $pageName, int $perPage = 15): LengthAwarePaginator
    {
        $currentPage = max(1, (int) $request->input($pageName, 1));

        return (new LengthAwarePaginator(
            $items->forPage($currentPage, $perPage)->values(),
            $items->count(),
            $perPage,
            $currentPage,
            [
                'path' => $request->url(),
                'pageName' => $pageName,
            ]
        ))->appends($request->query());
    }
}
