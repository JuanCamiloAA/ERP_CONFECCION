<?php

namespace App\Services\Dashboard;

use App\Models\Advance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\Production;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use App\Services\ProductionReportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Enumerable;
use Illuminate\Support\Facades\Cache;

class DashboardService
{
    protected const CACHE_SUPER_ADMIN_TTL = 120;

    protected const CACHE_COMPANY_ADMIN_TTL = 90;

    protected const CACHE_EMPLOYEE_TTL = 90;

    public function __construct(protected ProductionReportService $productionReports) {}

    /**
     * @return array<string, mixed>
     */
    public function getSuperAdminStats(?int $focusedCompanyId = null): array
    {
        $cacheKey = 'dashboard.super_admin.'.($focusedCompanyId ?? 'global');

        return Cache::remember($cacheKey, self::CACHE_SUPER_ADMIN_TTL, function () use ($focusedCompanyId) {
            $companiesActive = Company::query()->where('is_active', true)->count();
            $companiesTotal = Company::query()->count();
            $employeesActive = Employee::query()
                ->withoutGlobalScopes()
                ->where('is_active', true)
                ->count();

            $usersStaff = User::query()
                ->active()
                ->staff()
                ->count();

            $usersLinkedEmployees = User::query()
                ->active()
                ->employees()
                ->count();

            $focusedSummary = null;
            if ($focusedCompanyId !== null) {
                $focusedSummary = $this->buildFocusedCompanyCounts($focusedCompanyId);
            }

            $membershipsQuery = Company::query()->with(['membershipPlan:id,name']);

            if ($focusedCompanyId !== null) {
                $membershipsQuery->where('id', $focusedCompanyId);
            }

            $membershipsRows = $membershipsQuery
                ->orderBy('name')
                ->limit(250)
                ->get()
                ->map(fn (Company $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'nit' => $c->nit,
                    'is_active' => (bool) $c->is_active,
                    'plan_name' => $c->membershipPlan?->name ?? '—',
                    'membership_ends_at' => optional($c->membership_ends_at)?->toIso8601String(),
                    'badge' => $this->membershipBadge($c->membership_ends_at),
                ])
                ->all();

            return [
                'focused_company_id' => $focusedCompanyId,
                'companies_active_count' => $companiesActive,
                'companies_total_count' => $companiesTotal,
                'employees_active_count' => $employeesActive,
                'users_staff_count' => $usersStaff,
                'users_linked_employee_count' => $usersLinkedEmployees,
                'memberships' => $membershipsRows,
                'focused_company_summary' => $focusedSummary,
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function getCompanyAdminStats(int $companyId, int $productivityDays): array
    {
        $productivityDays = in_array($productivityDays, [7, 30, 90], true) ? $productivityDays : 30;

        $cacheKey = "dashboard.company.{$companyId}.pd{$productivityDays}";

        return Cache::remember($cacheKey, self::CACHE_COMPANY_ADMIN_TTL, function () use ($companyId, $productivityDays) {
            $producidoPendiente = $this->outstandingProductionValueOperationsForCompany($companyId);

            $empleadosActivos = Employee::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->count();

            $calculadas = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('status', Payroll::STATUS_CALCULATED)
                ->count();

            $aprobadas = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('status', Payroll::STATUS_APPROVED)
                ->count();

            $sinPagar = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('status', [
                    Payroll::STATUS_DRAFT,
                    Payroll::STATUS_CALCULATED,
                    Payroll::STATUS_APPROVED,
                ])
                ->count();

            $startDate = Carbon::now()->subDays($productivityDays - 1)->toDateString();
            $today = Carbon::now()->toDateString();

            $productivitySeries = $this->productionReports
                ->byEmployee($startDate, $today, $companyId, null, false)
                ->map(function ($row) {
                    return [
                        'employee_id' => $row->employee_id,
                        'name' => $this->employeeShortLabel($row->employee),
                        'short_name' => $this->employeeShortLabel($row->employee),
                        'total_quantity' => (int) $row->total_quantity,
                        'total_value' => (float) $row->total_value,
                    ];
                })
                ->values()
                ->all();

            $latestProductions = $this->serializeLatestProductionRows(
                Production::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->with(['employee:id,first_name,last_name', 'reference:id,code,name', 'operation:id,name'])
                    ->where('company_id', $companyId)
                    ->orderByDesc('date')
                    ->orderByDesc('id')
                    ->limit(5)
                    ->get()
            );

            $recentPayrolls = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->orderByDesc('period_end')
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn (Payroll $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'period_start' => $p->period_start?->toDateString(),
                    'period_end' => $p->period_end?->toDateString(),
                    'status' => $p->status,
                    'total_amount' => (float) ($p->total_amount ?? 0),
                ])
                ->all();

            return [
                'company_id' => $companyId,
                'productivity_days' => $productivityDays,
                'producido_pendiente_pago' => $producidoPendiente,
                'empleados_activos_count' => $empleadosActivos,
                'nomina_calculado_count' => $calculadas,
                'nomina_aprobado_count' => $aprobadas,
                'nomina_sin_pagar_count' => $sinPagar,
                'productividad_por_empleado' => $productivitySeries,
                'latest_productions' => $latestProductions,
                'recent_payrolls' => $recentPayrolls,
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function getEmployeeStats(Employee $employee): array
    {
        $cacheKey = "dashboard.employee.{$employee->id}";

        return Cache::remember($cacheKey, self::CACHE_EMPLOYEE_TTL, function () use ($employee) {
            $employeeId = (int) $employee->id;
            $companyId = (int) $employee->company_id;

            $unitsPending = 0;
            $valuePendingEstimate = null;

            if ($employee->isPayrollByOperations()) {
                $agg = Production::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('employee_id', $employeeId);
                OutstandingProductionQuery::applyNotLiquidadedAsPaid($agg);
                $rowAgg = $agg->selectRaw('COALESCE(SUM(quantity),0) as pending_qty, COALESCE(SUM(total_value),0) as pending_val')->first();
                $unitsPending = (int) ($rowAgg->pending_qty ?? 0);
                $valuePendingEstimate = round((float) ($rowAgg->pending_val ?? 0), 2);
            }

            $advancesQuery = Advance::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('employee_id', $employeeId)
                ->pending()
                ->orderByDesc('date')
                ->orderByDesc('id');

            $advancesTotal = (float) ($advancesQuery->clone())->sum('amount');

            $advancesPreview = (clone $advancesQuery)->limit(5)->get()->map(fn (Advance $a) => [
                'id' => $a->id,
                'date' => $a->date?->toDateString(),
                'amount' => (float) $a->amount,
                'reason' => $a->reason,
            ])->all();

            $nominasPendientesUsuario = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('status', [Payroll::STATUS_CALCULATED, Payroll::STATUS_APPROVED])
                ->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $employeeId))
                ->count();

            $payrollHistory = PayrollEmployee::query()
                ->selectRaw('payroll_employees.net_payment, payrolls.period_end, payrolls.name as payroll_name')
                ->join('payrolls', 'payroll_employees.payroll_id', '=', 'payrolls.id')
                ->whereNull('payrolls.deleted_at')
                ->where('payrolls.company_id', $companyId)
                ->where('payrolls.status', Payroll::STATUS_PAID)
                ->where('payroll_employees.employee_id', $employeeId)
                ->orderByDesc('payrolls.period_end')
                ->limit(12)
                ->get()
                ->sortBy(fn ($row) => $row->period_end?->timestamp ?? 0)
                ->values()
                ->map(fn ($row) => [
                    'period_end' => $row->period_end?->toDateString(),
                    'label' => (string) ($row->payroll_name ?? ''),
                    'net_payment' => (float) $row->net_payment,
                ])
                ->all();

            $latestProductions = $this->serializeLatestProductionRows(
                Production::query()
                    ->withoutGlobalScopes()
                    ->with(['employee:id,first_name,last_name', 'reference:id,code,name', 'operation:id,name'])
                    ->where('company_id', $companyId)
                    ->where('employee_id', $employeeId)
                    ->orderByDesc('date')
                    ->orderByDesc('id')
                    ->limit(5)
                    ->get()
            );

            return [
                'employee_id' => $employeeId,
                'payroll_mode' => $employee->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS,
                'unidades_pendientes_pagar' => $unitsPending,
                'valor_estimado_pendiente_pago' => $valuePendingEstimate,
                'anticipos_total_pendiente' => round($advancesTotal, 2),
                'anticipos_preview' => $advancesPreview,
                'nomina_abierta_count' => $nominasPendientesUsuario,
                'payroll_history_pagadas' => $payrollHistory,
                'latest_productions' => $latestProductions,
            ];
        });
    }

    /**
     * Producido operativo pendiente de pago: suma total_value donde el empleado liquida por operaciones
     * y la fecha aún no quedó cubierta por un período pagado (ver OutstandingProductionQuery).
     */
    protected function outstandingProductionValueOperationsForCompany(int $companyId): float
    {
        $q = Production::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereHas('employee', function ($employeeQuery) use ($companyId) {
                $employeeQuery->withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('payroll_mode', Employee::PAYROLL_MODE_OPERATIONS)
                    ->where('is_active', true);
            });
        OutstandingProductionQuery::applyNotLiquidadedAsPaid($q);

        return round((float) $q->sum('total_value'), 2);
    }

    protected function membershipBadge(mixed $membershipEndsAt): string
    {
        if ($membershipEndsAt === null) {
            return 'ok';
        }

        $end = Carbon::parse($membershipEndsAt)->startOfDay();
        $today = Carbon::today();
        $daysRemaining = $today->diffInDays($end, false);

        if ($daysRemaining < 0) {
            return 'expired';
        }
        if ($daysRemaining < 7) {
            return 'critical';
        }
        if ($daysRemaining < 30) {
            return 'warning';
        }

        return 'ok';
    }

    /** @param  Employee|null|Model  $employee */
    protected function employeeShortLabel($employee): string
    {
        if (! $employee) {
            return '—';
        }

        $first = (string) ($employee->first_name ?? '');
        $last = mb_substr((string) ($employee->last_name ?? ''), 0, 14);

        return trim(mb_substr($first, 0, 14).' '.$last) ?: ('#'.$employee->id);
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function buildFocusedCompanyCounts(int $companyId): ?array
    {
        $company = Company::query()->find($companyId);

        return [
            'company_id' => $companyId,
            'company_name' => $company?->name ?? '—',
            'employees_active_count' => Employee::query()->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->count(),
            'users_staff_count' => User::query()
                ->active()
                ->staff()
                ->forCompany($companyId)
                ->count(),
            'users_linked_employee_count' => User::query()
                ->active()
                ->employees()
                ->forCompany($companyId)
                ->count(),
        ];
    }

    /**
     * @param  iterable<int, Production|Enumerable>|Collection  $productions
     * @return list<array<string, mixed>>
     */
    protected function serializeLatestProductionRows($productions): array
    {
        $items = [];

        foreach ($productions as $p) {
            $items[] = [
                'id' => $p->id,
                'date' => $p->date?->toDateString(),
                'quantity' => (int) $p->quantity,
                'total_value' => (float) $p->total_value,
                'status' => $p->status,
                'company' => $p->relationLoaded('company') && $p->company ? [
                    'id' => $p->company->id,
                    'name' => $p->company->name,
                ] : null,
                'employee' => $p->employee ? [
                    'first_name' => $p->employee->first_name,
                    'last_name' => $p->employee->last_name,
                ] : null,
                'reference' => $p->reference ? ['code' => $p->reference->code ?? '', 'name' => $p->reference->name ?? ''] : null,
                'operation' => $p->operation ? ['name' => $p->operation->name] : null,
            ];
        }

        return $items;
    }
}
