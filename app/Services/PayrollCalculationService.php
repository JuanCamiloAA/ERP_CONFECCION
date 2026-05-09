<?php

namespace App\Services;

use App\Models\Advance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\Production;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkDaySession;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PayrollCalculationService
{
    public function calculate(Payroll $payroll, ?array $employeeAdjustments = null, ?User $adjustmentActor = null): Payroll
    {
        return DB::transaction(function () use ($payroll, $employeeAdjustments, $adjustmentActor) {
            $companyId = $payroll->company_id;

            if (! empty($employeeAdjustments)) {
                $this->applyWorkSessionAdjustments($companyId, $employeeAdjustments, $adjustmentActor);
            }

            $employees = Employee::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->where(function ($outer) use ($payroll) {
                    $outer->where(function ($q) use ($payroll) {
                        $q->where('payroll_mode', Employee::PAYROLL_MODE_OPERATIONS)
                            ->whereHas('productions', function ($pq) use ($payroll) {
                                $pq->withoutGlobalScopes()
                                    ->whereIn('status', [Production::STATUS_CONFIRMED, Production::STATUS_PENDING])
                                    ->whereBetween('date', [$payroll->period_start, $payroll->period_end])
                                    ->where(function ($inner) use ($payroll) {
                                        $cid = (int) $payroll->company_id;
                                        $inner->where('company_id', $cid)
                                            ->orWhereHas('reference', fn ($r) => $r->where('company_id', $cid));
                                    });
                            });
                    })->orWhere(function ($q) {
                        $q->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY);
                    });
                })
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get();

            $computedEmployeeIds = $employees->pluck('id')->all();

            $staleRows = PayrollEmployee::query()
                ->where('payroll_id', $payroll->id)
                ->whereNotIn('employee_id', $computedEmployeeIds)
                ->get();

            foreach ($staleRows as $stale) {
                Advance::query()
                    ->withoutGlobalScopes()
                    ->where('payroll_employee_id', $stale->id)
                    ->update(['payroll_employee_id' => null]);
                $stale->delete();
            }

            foreach ($employees as $employee) {
                $validatedWorkDays = null;
                $productionTotal = 0.0;
                $dailyWorkSubtotal = 0.0;

                if ($employee->isPayrollByOperations()) {
                    $productionTotal = (float) Production::query()
                        ->withoutGlobalScopes()
                        ->where('employee_id', $employee->id)
                        ->whereIn('status', [Production::STATUS_CONFIRMED, Production::STATUS_PENDING])
                        ->whereBetween('date', [$payroll->period_start, $payroll->period_end])
                        ->where(function ($inner) use ($companyId) {
                            $inner->where('company_id', $companyId)
                                ->orWhereHas('reference', fn ($r) => $r->where('company_id', $companyId));
                        })
                        ->sum('total_value');
                    $dailyWorkSubtotal = 0.0;
                    $validatedWorkDays = [];
                } else {
                    $productionTotal = 0.0;
                    $daily = $this->computeFixedDailyEarnings($employee, $payroll);
                    $dailyWorkSubtotal = $daily['subtotal'];
                    $validatedWorkDays = $daily['validated_work_days'];
                }

                $payrollEmployee = PayrollEmployee::query()->updateOrCreate(
                    [
                        'payroll_id' => $payroll->id,
                        'employee_id' => $employee->id,
                    ],
                    [
                        'production_total' => round($productionTotal, 2),
                        'daily_work_subtotal' => round($dailyWorkSubtotal, 2),
                        'validated_work_days' => $validatedWorkDays,
                        'additions' => [],
                        'is_paid' => false,
                    ],
                );

                $advances = Advance::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('employee_id', $employee->id)
                    ->where('status', Advance::STATUS_PENDING)
                    ->get();

                foreach ($advances as $advance) {
                    $advance->payroll_employee_id = $payrollEmployee->id;
                    $advance->save();
                }

                $this->recalculatePayrollEmployeeTotals($payrollEmployee);
            }

            $this->refreshPayrollTotal($payroll);

            $payroll->update([
                'status' => Payroll::STATUS_CALCULATED,
            ]);

            return $payroll->fresh('payrollEmployees.employee');
        });
    }

    /**
     * Devengado bruto empleado = production_total + daily_work_subtotal + suma de ajustes manuales (>= 0).
     * Sobre ese bruto se aplican deducciones porcentuales y descuentos por anticipos.
     */
    public function recalculatePayrollEmployeeTotals(PayrollEmployee $payrollEmployee): void
    {
        $payrollEmployee->loadMissing('payroll');
        $companyId = (int) $payrollEmployee->payroll->company_id;
        $defaults = $this->getDefaultDeductions($companyId);

        $adjustmentsSubtotal = round((float) $payrollEmployee->adjustments()->sum('amount'), 2);
        $productionTotal = (float) $payrollEmployee->production_total;
        $dailyWorkSubtotal = (float) $payrollEmployee->daily_work_subtotal;
        $gross = round($productionTotal + $dailyWorkSubtotal + $adjustmentsSubtotal, 2);

        $deductions = $this->buildDeductionsArray($defaults, $gross);
        $deductionsAmount = round((float) collect($deductions)->sum('amount'), 2);

        $advancesDiscount = round((float) Advance::query()
            ->withoutGlobalScopes()
            ->where('payroll_employee_id', $payrollEmployee->id)
            ->where('status', Advance::STATUS_PENDING)
            ->sum('amount'), 2);

        $netPayment = max(0, round($gross - $deductionsAmount - $advancesDiscount, 2));

        $payrollEmployee->update([
            'adjustments_subtotal' => $adjustmentsSubtotal,
            'deductions' => $deductions,
            'advances_discount' => $advancesDiscount,
            'net_payment' => $netPayment,
        ]);
    }

    public function refreshPayrollTotal(Payroll $payroll): void
    {
        $total = (float) PayrollEmployee::query()
            ->where('payroll_id', $payroll->id)
            ->sum('net_payment');

        $payroll->update(['total_amount' => round($total, 2)]);
    }

    /**
     * @param  array<int, array{employee_id: int, sessions?: array<int, array<string, mixed>>}>|null  $adjustments
     */
    protected function applyWorkSessionAdjustments(int $companyId, array $adjustments, ?User $user): void
    {
        foreach ($adjustments as $block) {
            $employeeId = (int) ($block['employee_id'] ?? 0);
            if ($employeeId < 1) {
                continue;
            }

            $employee = Employee::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->find($employeeId);

            if (! $employee || ! $employee->isPayrollFixedDaily()) {
                continue;
            }

            foreach ($block['sessions'] ?? [] as $row) {
                $sessionId = (int) ($row['session_id'] ?? 0);
                if ($sessionId < 1) {
                    continue;
                }

                $session = WorkDaySession::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('employee_id', $employeeId)
                    ->find($sessionId);

                if (! $session || $session->clock_out_at === null) {
                    continue;
                }

                $in = isset($row['clock_in_at']) ? Carbon::parse($row['clock_in_at']) : $session->clock_in_at->copy();

                if (isset($row['clock_out_at'])) {
                    $out = Carbon::parse($row['clock_out_at']);
                } elseif (isset($row['duration_minutes'])) {
                    $out = $in->copy()->addMinutes(max(1, (int) $row['duration_minutes']));
                } else {
                    $out = $session->clock_out_at->copy();
                }

                if ($out->lte($in)) {
                    continue;
                }

                $duration = isset($row['duration_minutes'])
                    ? (int) $row['duration_minutes']
                    : $this->durationMinutesBetween($in, $out);

                $session->update([
                    'clock_in_at' => $in,
                    'clock_out_at' => $out,
                    'duration_minutes' => $duration,
                    'status' => WorkDaySession::STATUS_ADJUSTED,
                    'adjusted_by_user_id' => $user?->id,
                    'adjusted_at' => now(),
                    'notes' => isset($row['reason']) ? trim((string) $row['reason']) : $session->notes,
                ]);
            }
        }
    }

    protected function durationMinutesBetween(Carbon $in, Carbon $out): int
    {
        return max(0, (int) round($in->diffInMinutes($out)));
    }

    /**
     * @return array{subtotal: float, validated_work_days: array<int, array<string, mixed>>}
     */
    protected function computeFixedDailyEarnings(Employee $employee, Payroll $payroll): array
    {
        $minutesFull = max(1, (int) $employee->minutes_per_full_workday);
        $dailySalary = (float) ($employee->daily_salary ?? 0);

        $sessions = WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->where('employee_id', $employee->id)
            ->whereBetween('work_date', [$payroll->period_start, $payroll->period_end])
            ->whereIn('status', [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED])
            ->orderBy('work_date')
            ->orderBy('id')
            ->get();

        $validated = [];
        $subtotal = 0.0;

        foreach ($sessions as $session) {
            $dm = (int) ($session->duration_minutes ?? 0);
            $effectiveMinutes = min($dm, $minutesFull);
            $dayEarnings = round($dailySalary * ($effectiveMinutes / $minutesFull), 2);
            $subtotal += $dayEarnings;

            $validated[] = [
                'work_date' => $session->work_date instanceof \DateTimeInterface
                    ? $session->work_date->format('Y-m-d')
                    : (string) $session->getRawOriginal('work_date'),
                'session_id' => $session->id,
                'clock_in_at' => $session->clock_in_at?->toIso8601String(),
                'clock_out_at' => $session->clock_out_at?->toIso8601String(),
                'duration_minutes' => $dm,
                'effective_minutes' => $effectiveMinutes,
                'daily_salary_applied' => $dailySalary,
                'minutes_full_workday' => $minutesFull,
                'day_earnings' => $dayEarnings,
            ];
        }

        return [
            'subtotal' => round($subtotal, 2),
            'validated_work_days' => $validated,
        ];
    }

    public function approve(Payroll $payroll): Payroll
    {
        if (! $payroll->canBeApproved()) {
            throw new \DomainException('Esta nomina no puede ser aprobada en su estado actual.');
        }

        $payroll->update(['status' => Payroll::STATUS_APPROVED]);

        return $payroll;
    }

    public function markAsPaid(Payroll $payroll): Payroll
    {
        if (! $payroll->canBePaid()) {
            throw new \DomainException('Solo las nominas aprobadas pueden marcarse como pagadas.');
        }

        return DB::transaction(function () use ($payroll) {
            $payroll->update([
                'status' => Payroll::STATUS_PAID,
                'paid_at' => now(),
            ]);

            $payroll->payrollEmployees()->update([
                'is_paid' => true,
                'paid_at' => now(),
            ]);

            Advance::query()
                ->withoutGlobalScopes()
                ->whereIn('payroll_employee_id', $payroll->payrollEmployees()->pluck('id'))
                ->update(['status' => Advance::STATUS_DISCOUNTED]);

            return $payroll->fresh();
        });
    }

    protected function getDefaultDeductions(int $companyId): array
    {
        $stored = Setting::get('default_deductions', null, $companyId);
        if ($stored && is_string($stored)) {
            $decoded = json_decode($stored, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $company = Company::find($companyId);
        $settings = $company?->settings ?? [];
        if (isset($settings['default_deductions']) && is_array($settings['default_deductions'])) {
            return $settings['default_deductions'];
        }

        return [
            ['key' => 'salud', 'label' => 'Salud', 'percent' => 4],
            ['key' => 'pension', 'label' => 'Pension', 'percent' => 4],
        ];
    }

    protected function buildDeductionsArray(array $defaults, float $base): array
    {
        $result = [];
        foreach ($defaults as $deduction) {
            $percent = (float) ($deduction['percent'] ?? 0);
            $amount = round($base * ($percent / 100), 2);
            $result[] = [
                'key' => $deduction['key'] ?? 'misc',
                'label' => $deduction['label'] ?? 'Deduccion',
                'percent' => $percent,
                'amount' => $amount,
            ];
        }

        return $result;
    }
}
