<?php

namespace App\Services;

use App\Models\Advance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\Production;
use App\Models\Reference;
use App\Models\Scopes\CompanyScope;
use Illuminate\Support\Carbon;

class DashboardStatsService
{
    public function __construct(protected ProductionReportService $reports) {}

    /**
     * @param  int|null  $companyId  null = todas las empresas (solo super admin consolidado).
     * @param  int|null  $scopedEmployeeId  Si viene informado (empleado no administrador), todas las metricas son solo de ese empleado.
     */
    public function stats(?int $companyId, ?int $scopedEmployeeId = null): array
    {
        $monthStart = Carbon::now()->startOfMonth()->toDateString();
        $monthEnd = Carbon::now()->endOfMonth()->toDateString();
        $weekStart = Carbon::now()->subDays(6)->toDateString();
        $today = Carbon::now()->toDateString();

        $isConsolidated = $companyId === null;
        $isPersonal = $scopedEmployeeId !== null;

        $employeesActive = null;
        $referencesActive = null;
        if (! $isPersonal) {
            $employeesQ = Employee::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('is_active', true);
            $referencesQ = Reference::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('is_active', true);
            if ($companyId !== null) {
                $employeesQ->where('company_id', $companyId);
                $referencesQ->where('company_id', $companyId);
            }
            $employeesActive = $employeesQ->count();
            $referencesActive = $referencesQ->count();
        }

        $productionMonthQuery = Production::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereBetween('date', [$monthStart, $monthEnd]);
        if ($companyId !== null) {
            $productionMonthQuery->where('company_id', $companyId);
        }

        if ($scopedEmployeeId) {
            $productionMonthQuery->where('employee_id', $scopedEmployeeId);
        }

        if ($isPersonal) {
            $productionMonthQuery->where('status', Production::STATUS_CONFIRMED);
        }

        $productionMonth = (float) $productionMonthQuery->clone()->sum('total_value');
        $productionMonthQty = (int) $productionMonthQuery->sum('quantity');
        $productionMonthRecords = (int) $productionMonthQuery->clone()->count();

        $productionPendingValue = 0.0;
        $productionPendingQuantity = 0;
        if ($scopedEmployeeId) {
            $pendingRow = Production::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
                ->where('employee_id', $scopedEmployeeId)
                ->where('status', Production::STATUS_PENDING)
                ->selectRaw('COALESCE(SUM(total_value), 0) as total_value, COALESCE(SUM(quantity), 0) as total_qty')
                ->first();
            $productionPendingValue = (float) ($pendingRow->total_value ?? 0);
            $productionPendingQuantity = (int) ($pendingRow->total_qty ?? 0);
        }

        $payrollsPendingBase = Payroll::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId));

        if ($isPersonal) {
            $payrollsPending = (clone $payrollsPendingBase)
                ->whereIn('status', [Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])
                ->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $scopedEmployeeId))
                ->count();
        } else {
            $payrollsPending = (clone $payrollsPendingBase)
                ->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])
                ->count();
        }

        $advancesPendingQuery = Advance::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('status', Advance::STATUS_PENDING)
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId));

        if ($scopedEmployeeId) {
            $advancesPendingQuery->where('employee_id', $scopedEmployeeId);
        }

        $advancesPending = (float) $advancesPendingQuery->sum('amount');

        $weekSeries = $this->reports->dailySeries($weekStart, $today, $companyId, $scopedEmployeeId, $isPersonal);

        $topEmployees = [];
        $topReferences = [];
        if ($isPersonal) {
            $topReferences = $this->reports->byReference($monthStart, $monthEnd, $companyId, $scopedEmployeeId, true)
                ->take(5)
                ->filter(fn ($row) => $row->reference !== null)
                ->map(fn ($row) => [
                    'reference_id' => $row->reference_id,
                    'name' => trim(($row->reference->code ?? '').' · '.($row->reference->name ?? '')),
                    'total_quantity' => (int) $row->total_quantity,
                    'total_value' => (float) $row->total_value,
                ])
                ->values()
                ->toArray();
        } else {
            $topEmployees = $this->reports->byEmployee($monthStart, $monthEnd, $companyId, null, false)
                ->take(5)
                ->map(fn ($row) => [
                    'employee_id' => $row->employee_id,
                    'name' => trim(($row->employee->first_name ?? '').' '.($row->employee->last_name ?? '')),
                    'total_quantity' => (int) $row->total_quantity,
                    'total_value' => (float) $row->total_value,
                ])
                ->values()
                ->toArray();
        }

        $latestProductionsQuery = Production::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with(['employee:id,first_name,last_name', 'reference:id,code,name', 'operation:id,name', 'company:id,name'])
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId));

        if ($scopedEmployeeId) {
            $latestProductionsQuery->where('employee_id', $scopedEmployeeId);
        }

        $latestProductions = $latestProductionsQuery
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $pendingPayrollsQuery = Payroll::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])
            ->orderByDesc('period_end')
            ->limit(5);

        if ($scopedEmployeeId) {
            $pendingPayrollsQuery->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $scopedEmployeeId));
        }

        $pendingPayrolls = $pendingPayrollsQuery->get();

        $companiesActiveCount = null;
        if ($isConsolidated && ! $isPersonal) {
            $companiesActiveCount = Company::query()->where('is_active', true)->count();
        }

        return [
            'is_consolidated' => $isConsolidated,
            'is_personal' => $isPersonal,
            'companies_active_count' => $companiesActiveCount,
            'employees_active' => $employeesActive,
            'references_active' => $referencesActive,
            'production_pending_value' => $productionPendingValue,
            'production_pending_quantity' => $productionPendingQuantity,
            'production_month' => $productionMonth,
            'production_month_quantity' => $productionMonthQty,
            'production_month_records' => $productionMonthRecords,
            'payrolls_pending' => $payrollsPending,
            'advances_pending' => $advancesPending,
            'week_series' => $weekSeries,
            'top_employees' => $topEmployees,
            'top_references' => $topReferences,
            'latest_productions' => $latestProductions,
            'pending_payrolls' => $pendingPayrolls,
        ];
    }
}
