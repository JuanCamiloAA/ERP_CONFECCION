<?php

namespace App\Services;

use App\Models\Advance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\PayrollLegalParameter;
use App\Models\Production;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkDaySession;
use App\Services\HolidayService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PayrollCalculationService
{
    public function __construct(
        protected PayrollLegalParameterResolver $legalParams,
        protected HolidayService $holidays,
    ) {}

    /**
     * @param  array<int, array{employee_id: int, sessions?: array<int, array<string, mixed>>}>|null  $employeeAdjustments
     * @param  array<int, array{employee_id: int, dates?: array<int, array{date: string, discount?: bool, note?: string|null}>}>|null  $absenceConfirmations
     * @param  array<int, array{employee_id: int, advances?: array<int, array{advance_id: int, applied_amount: float|string}>}>|null  $advanceAdjustments
     */
    public function calculate(
        Payroll $payroll,
        ?array $employeeAdjustments = null,
        ?User $adjustmentActor = null,
        ?array $absenceConfirmations = null,
        ?array $advanceAdjustments = null,
    ): Payroll {
        return DB::transaction(function () use ($payroll, $employeeAdjustments, $adjustmentActor, $absenceConfirmations, $advanceAdjustments) {
            $companyId = $payroll->company_id;

            if (! empty($employeeAdjustments)) {
                $this->applyWorkSessionAdjustments($companyId, $employeeAdjustments, $adjustmentActor);
            }

            $absenceConfirmationsByEmployee = collect($absenceConfirmations ?? [])
                ->keyBy(fn ($block) => (int) ($block['employee_id'] ?? 0));

            // advance_id => monto aplicado solicitado por el admin (parcial o total); si un anticipo
            // pendiente no aparece aca, se descuenta por el saldo completo (comportamiento previo).
            $advanceAppliedAmounts = collect($advanceAdjustments ?? [])
                ->flatMap(fn ($block) => $block['advances'] ?? [])
                ->filter(fn ($row) => isset($row['advance_id']))
                ->mapWithKeys(fn ($row) => [(int) $row['advance_id'] => (float) ($row['applied_amount'] ?? 0)]);

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
                        $q->whereIn('payroll_mode', [
                            Employee::PAYROLL_MODE_FIXED_DAILY,
                            Employee::PAYROLL_MODE_HOURLY_LEGAL,
                        ]);
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
                    ->update(['payroll_employee_id' => null, 'applied_amount' => null]);
                $stale->delete();
            }

            $allOvertimeAlerts = [];

            foreach ($employees as $employee) {
                $validatedWorkDays = null;
                $productionTotal = 0.0;
                $dailyWorkSubtotal = 0.0;
                $legalHourlySubtotal = 0.0;
                $legalHoursBreakdown = null;
                $overtimeLimitAlerts = [];
                $absenceDiscountTotal = 0.0;
                $absenceDiscountDetail = [];

                $absenceConfirmationsForEmployee = collect(
                    $absenceConfirmationsByEmployee->get((int) $employee->id)['dates'] ?? []
                )->keyBy('date');

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
                    // guarda explicita §3.9: operations nunca pasa por el descuento de inasistencia
                } elseif ($employee->isPayrollHourlyLegal()) {
                    $legal = $this->computeLegalHourlyEarnings($employee, $payroll);
                    $legalHourlySubtotal = $legal['subtotal'];
                    $legalHoursBreakdown = $legal['breakdown'];
                    $overtimeLimitAlerts = $legal['overtime_limit_alerts'];
                    $validatedWorkDays = [];

                    foreach ($overtimeLimitAlerts as $alert) {
                        $allOvertimeAlerts[] = "{$employee->full_name}: {$alert}";
                    }

                    $absence = $this->computeAbsenceDiscount($employee, $payroll, $absenceConfirmationsForEmployee, $adjustmentActor);
                    $absenceDiscountTotal = $absence['total'];
                    $absenceDiscountDetail = $absence['detail'];
                } else {
                    $daily = $this->computeFixedDailyEarnings($employee, $payroll);
                    $dailyWorkSubtotal = $daily['subtotal'];
                    $validatedWorkDays = $daily['validated_work_days'];

                    // fixed_daily: la inasistencia ya no genera day_earnings (comportamiento actual sin
                    // cambios); el resultado aqui es solo trazabilidad, nunca resta de daily_work_subtotal
                    $absence = $this->computeAbsenceDiscount($employee, $payroll, $absenceConfirmationsForEmployee, $adjustmentActor);
                    $absenceDiscountTotal = $absence['total'];
                    $absenceDiscountDetail = $absence['detail'];
                }

                $payrollEmployee = PayrollEmployee::query()->updateOrCreate(
                    [
                        'payroll_id' => $payroll->id,
                        'employee_id' => $employee->id,
                    ],
                    [
                        'production_total' => round($productionTotal, 2),
                        'daily_work_subtotal' => round($dailyWorkSubtotal, 2),
                        'legal_hourly_subtotal' => round($legalHourlySubtotal, 2),
                        'legal_hours_breakdown' => $legalHoursBreakdown,
                        'overtime_limit_alerts' => $overtimeLimitAlerts,
                        'absence_discount_total' => round($absenceDiscountTotal, 2),
                        'absence_discount_detail' => $absenceDiscountDetail,
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
                    ->where('remaining_amount', '>', 0)
                    ->get();

                foreach ($advances as $advance) {
                    $remaining = (float) $advance->remaining_amount;
                    $requested = $advanceAppliedAmounts->get((int) $advance->id);
                    // Sin override del admin -> se descuenta el saldo completo (comportamiento previo,
                    // sin cambios para quien no use la opcion de descuento parcial).
                    $applied = $requested === null ? $remaining : min(max($requested, 0.01), $remaining);

                    $advance->payroll_employee_id = $payrollEmployee->id;
                    $advance->applied_amount = round($applied, 2);
                    $advance->save();
                }

                $this->recalculatePayrollEmployeeTotals($payrollEmployee);
            }

            if ($allOvertimeAlerts !== [] && $this->blockOvertimeOverLegalLimit($companyId)) {
                throw new \DomainException(
                    "No se puede calcular: hay horas extra que exceden el tope legal y el bloqueo esta activado.\n".
                    implode("\n", $allOvertimeAlerts)
                );
            }

            $this->refreshPayrollTotal($payroll);

            $payroll->update([
                'status' => Payroll::STATUS_CALCULATED,
            ]);

            return $payroll->fresh('payrollEmployees.employee');
        });
    }

    /**
     * Devengado bruto empleado = production_total + daily_work_subtotal + legal_hourly_subtotal +
     * suma de ajustes manuales (>= 0). Sobre ese bruto se aplican deducciones porcentuales,
     * descuentos por anticipos y el descuento por inasistencia (§3.9; se resta al neto, no al bruto).
     */
    public function recalculatePayrollEmployeeTotals(PayrollEmployee $payrollEmployee): void
    {
        $payrollEmployee->loadMissing('payroll');
        $companyId = (int) $payrollEmployee->payroll->company_id;
        $defaults = $this->getDefaultDeductions($companyId);

        $adjustmentsSubtotal = round((float) $payrollEmployee->adjustments()->sum('amount'), 2);
        $productionTotal = (float) $payrollEmployee->production_total;
        $dailyWorkSubtotal = (float) $payrollEmployee->daily_work_subtotal;
        $legalHourlySubtotal = (float) $payrollEmployee->legal_hourly_subtotal;
        $gross = round($productionTotal + $dailyWorkSubtotal + $legalHourlySubtotal + $adjustmentsSubtotal, 2);

        $deductions = $this->buildDeductionsArray($defaults, $gross);
        $deductionsAmount = round((float) collect($deductions)->sum('amount'), 2);

        $advancesDiscount = round((float) Advance::query()
            ->withoutGlobalScopes()
            ->where('payroll_employee_id', $payrollEmployee->id)
            ->where('status', Advance::STATUS_PENDING)
            ->sum('applied_amount'), 2);

        $absenceDiscountTotal = (float) $payrollEmployee->absence_discount_total;

        $netPayment = max(0, round($gross - $deductionsAmount - $advancesDiscount - $absenceDiscountTotal, 2));

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

            if (! $employee || ! $employee->usesWorkDaySessions()) {
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

                if (Payroll::paidPeriodCoversDate($companyId, $session->work_date)) {
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

    /**
     * Modalidad hourly_legal (§3 del prompt de nomina legal): salario base prorrateado por dias
     * calendario del periodo + recargo nocturno + recargo dominical/festivo + horas extra, todo
     * resuelto sesion por sesion contra el tramo de payroll_legal_parameters vigente en el work_date
     * propio de cada sesion (nunca un unico tramo fijado para todo el periodo, ver §3.1).
     *
     * @return array{subtotal: float, breakdown: array<string, mixed>, overtime_limit_alerts: list<string>}
     */
    protected function computeLegalHourlyEarnings(Employee $employee, Payroll $payroll): array
    {
        $baseSalary = (float) ($employee->base_salary ?? 0);

        $periodStart = Carbon::parse($payroll->period_start);
        $periodEnd = Carbon::parse($payroll->period_end);
        // Convencion mensual/30 dias, igual que el resto de la nomina (ver §3.3): el salario mensual
        // ya remunera todos los dias calendario del periodo, incluido el descanso semanal.
        $daysInPeriod = $periodStart->diffInDays($periodEnd) + 1;
        $baseSalaryEarned = round($baseSalary * ($daysInPeriod / 30), 2);

        $sessions = WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->where('employee_id', $employee->id)
            ->whereBetween('work_date', [$payroll->period_start, $payroll->period_end])
            ->whereIn('status', [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED])
            ->orderBy('work_date')
            ->orderBy('id')
            ->get();

        $minuteBuckets = [
            'ordinary_day_minutes' => 0,
            'ordinary_night_minutes' => 0,
            'sunday_holiday_day_minutes' => 0,
            'sunday_holiday_night_minutes' => 0,
            'overtime_day_minutes' => 0,
            'overtime_night_minutes' => 0,
            'overtime_sunday_holiday_day_minutes' => 0,
            'overtime_sunday_holiday_night_minutes' => 0,
        ];

        $nightSurchargeAmount = 0.0;
        $overtimeAmount = 0.0;
        $sundayHolidaySurchargeAmount = 0.0;
        $lastHourlyRate = 0.0;
        $lastParamsSnapshot = null;

        $weeklyOrdinaryMinutes = []; // clave = lunes ISO de la semana => minutos ordinarios acumulados
        $weeklyOvertimeMinutes = []; // clave = lunes ISO de la semana => minutos extra acumulados
        $weeklyParams = []; // clave = lunes ISO de la semana => ultimo tramo resuelto en esa semana

        $dailyDetail = [];
        $alerts = [];

        foreach ($sessions as $session) {
            $workDate = Carbon::parse($session->work_date);
            $params = $this->legalParams->resolve((int) $payroll->company_id, $workDate);
            $isSundayHoliday = $this->holidays->isHolidayOrSunday($workDate);
            $weekKey = $workDate->copy()->startOfWeek(Carbon::MONDAY)->toDateString();

            $hourlyRate = (float) $params->monthly_hours_divisor > 0
                ? $baseSalary / (float) $params->monthly_hours_divisor
                : 0.0;
            $lastHourlyRate = $hourlyRate;
            $lastParamsSnapshot = $this->legalParameterSnapshot($params);

            $usedOrdinaryThisWeek = $weeklyOrdinaryMinutes[$weekKey] ?? 0;
            $classified = $this->classifySessionMinutes($session, $employee, $params, $usedOrdinaryThisWeek);
            $weeklyOrdinaryMinutes[$weekKey] = $usedOrdinaryThisWeek + $classified['ordinary_minutes'];
            $weeklyOvertimeMinutes[$weekKey] = ($weeklyOvertimeMinutes[$weekKey] ?? 0) + $classified['extra_minutes'];
            $weeklyParams[$weekKey] = $params;

            $sessionTotalMinutes = $classified['ordinary_day'] + $classified['ordinary_night']
                + $classified['extra_day'] + $classified['extra_night'];

            $sessionNightSurcharge = round(($classified['ordinary_night'] / 60) * $hourlyRate * ((float) $params->night_surcharge_percent / 100), 2);
            $sessionOvertime = round(
                ($classified['extra_day'] / 60) * $hourlyRate * ((float) $params->overtime_day_percent / 100)
                + ($classified['extra_night'] / 60) * $hourlyRate * ((float) $params->overtime_night_percent / 100),
                2
            );
            $sessionSunday = $isSundayHoliday
                ? round(($sessionTotalMinutes / 60) * $hourlyRate * ((float) $params->sunday_holiday_surcharge_percent / 100), 2)
                : 0.0;

            $nightSurchargeAmount += $sessionNightSurcharge;
            $overtimeAmount += $sessionOvertime;
            $sundayHolidaySurchargeAmount += $sessionSunday;

            $overtimePrefix = $isSundayHoliday ? 'overtime_sunday_holiday_' : 'overtime_';
            $minuteBuckets[($isSundayHoliday ? 'sunday_holiday_day_minutes' : 'ordinary_day_minutes')] += $classified['ordinary_day'];
            $minuteBuckets[($isSundayHoliday ? 'sunday_holiday_night_minutes' : 'ordinary_night_minutes')] += $classified['ordinary_night'];
            $minuteBuckets[$overtimePrefix.'day_minutes'] += $classified['extra_day'];
            $minuteBuckets[$overtimePrefix.'night_minutes'] += $classified['extra_night'];

            $dayExtraMinutes = $classified['extra_day'] + $classified['extra_night'];
            if ($dayExtraMinutes > ((float) $params->max_overtime_hours_per_day * 60)) {
                $hours = round($dayExtraMinutes / 60, 2);
                $alerts[] = "{$workDate->toDateString()}: {$hours}h extra (excede tope diario de {$params->max_overtime_hours_per_day}h)";
            }

            $dailyDetail[] = [
                'work_date' => $workDate->toDateString(),
                'session_id' => $session->id,
                'clock_in_at' => $session->clock_in_at?->toIso8601String(),
                'clock_out_at' => $session->clock_out_at?->toIso8601String(),
                'duration_minutes' => (int) $session->duration_minutes,
                'ordinary_day_minutes' => $classified['ordinary_day'],
                'ordinary_night_minutes' => $classified['ordinary_night'],
                'extra_day_minutes' => $classified['extra_day'],
                'extra_night_minutes' => $classified['extra_night'],
                'is_sunday_holiday' => $isSundayHoliday,
                'hourly_rate' => round($hourlyRate, 2),
                'day_amount' => round($sessionNightSurcharge + $sessionOvertime + $sessionSunday, 2),
            ];
        }

        foreach ($weeklyOvertimeMinutes as $weekKey => $minutes) {
            /** @var PayrollLegalParameter $weekParams */
            $weekParams = $weeklyParams[$weekKey];
            if ($minutes > ((float) $weekParams->max_overtime_hours_per_week * 60)) {
                $hours = round($minutes / 60, 2);
                $alerts[] = "Semana de {$weekKey}: {$hours}h extra (excede tope semanal de {$weekParams->max_overtime_hours_per_week}h)";
            }
        }

        $subtotal = round($baseSalaryEarned + $nightSurchargeAmount + $overtimeAmount + $sundayHolidaySurchargeAmount, 2);

        $breakdown = array_merge($minuteBuckets, [
            'base_salary_earned' => $baseSalaryEarned,
            'days_in_period' => $daysInPeriod,
            'hourly_rate_applied' => round($lastHourlyRate, 2),
            'night_surcharge_amount' => round($nightSurchargeAmount, 2),
            'sunday_holiday_surcharge_amount' => round($sundayHolidaySurchargeAmount, 2),
            'overtime_amount' => round($overtimeAmount, 2),
            'legal_parameters_snapshot' => $lastParamsSnapshot,
            'daily_detail' => $dailyDetail,
        ]);

        return [
            'subtotal' => $subtotal,
            'breakdown' => $breakdown,
            'overtime_limit_alerts' => $alerts,
        ];
    }

    /**
     * Reparte los minutos de una sesion entre ordinario/extra (segun el tope diario del empleado y
     * el tope semanal restante del tramo vigente, §3.2 paso 1) y cada uno de esos dos grupos entre
     * franja diurna/nocturna (§3.2 paso 2), cruzando clock_in_at/clock_out_at contra el horario
     * nocturno del tramo. Los minutos "ordinarios" son siempre los primeros cronologicamente (la
     * jornada pactada se cumple antes de entrar en tiempo extra); es la convencion estandar de
     * liquidacion de horas extra y no esta explicitada de otra forma en la ley.
     *
     * @return array{ordinary_minutes: int, extra_minutes: int, ordinary_day: int, ordinary_night: int, extra_day: int, extra_night: int}
     */
    protected function classifySessionMinutes(
        WorkDaySession $session,
        Employee $employee,
        PayrollLegalParameter $params,
        int $ordinaryMinutesUsedThisWeek,
    ): array {
        $sessionMinutes = (int) $session->duration_minutes;
        $dailyCapMinutes = (int) round((float) $employee->ordinary_hours_per_day * 60);
        $weeklyCapMinutes = (int) round((float) $params->weekly_legal_hours * 60);
        $weeklyRemaining = max(0, $weeklyCapMinutes - $ordinaryMinutesUsedThisWeek);

        $ordinaryMinutes = min($sessionMinutes, $dailyCapMinutes, $weeklyRemaining);
        $extraMinutes = $sessionMinutes - $ordinaryMinutes;

        if ($employee->is_exempt_from_overtime) {
            $ordinaryMinutes = $sessionMinutes;
            $extraMinutes = 0;
        }

        $clockIn = $session->clock_in_at->copy();
        $clockOut = $session->clock_out_at->copy();
        $ordinaryEnd = $clockIn->copy()->addMinutes($ordinaryMinutes);

        $ordinaryNight = $ordinaryMinutes > 0
            ? $this->nightMinutesInRange($clockIn, $ordinaryEnd, $params->night_start_time, $params->night_end_time)
            : 0;
        $ordinaryDay = $ordinaryMinutes - $ordinaryNight;

        $extraNight = $extraMinutes > 0
            ? $this->nightMinutesInRange($ordinaryEnd, $clockOut, $params->night_start_time, $params->night_end_time)
            : 0;
        $extraDay = $extraMinutes - $extraNight;

        return [
            'ordinary_minutes' => $ordinaryMinutes,
            'extra_minutes' => $extraMinutes,
            'ordinary_day' => $ordinaryDay,
            'ordinary_night' => $ordinaryNight,
            'extra_day' => $extraDay,
            'extra_night' => $extraNight,
        ];
    }

    /**
     * Minutos de [start, end) que caen dentro de la franja nocturna del tramo. La franja nocturna
     * puede cruzar medianoche (ej. 19:00-06:00) o no; se recorre dia por dia porque una sesion puede
     * cruzar el limite dia/noche varias veces (§3.2: "recorrer por segmentos, no asumir una sola
     * franja por sesion").
     */
    protected function nightMinutesInRange(Carbon $start, Carbon $end, string $nightStart, string $nightEnd): int
    {
        if ($end->lte($start)) {
            return 0;
        }

        $minutes = 0;
        $cursor = $start->copy()->startOfDay();
        $lastDay = $end->copy()->startOfDay();

        while ($cursor->lte($lastDay)) {
            [$windowStart, $windowEnd] = $this->nightWindowForDay($cursor, $nightStart, $nightEnd);

            $overlapStart = $windowStart->greaterThan($start) ? $windowStart : $start;
            $overlapEnd = $windowEnd->lessThan($end) ? $windowEnd : $end;

            if ($overlapEnd->gt($overlapStart)) {
                $minutes += $overlapStart->diffInMinutes($overlapEnd);
            }

            $cursor->addDay();
        }

        return $minutes;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function nightWindowForDay(Carbon $day, string $nightStart, string $nightEnd): array
    {
        $start = $day->copy()->setTimeFromTimeString($nightStart);
        $end = $day->copy()->setTimeFromTimeString($nightEnd);

        if ($end->lte($start)) {
            $end->addDay();
        }

        return [$start, $end];
    }

    /**
     * @return array<string, mixed>
     */
    protected function legalParameterSnapshot(PayrollLegalParameter $params): array
    {
        return [
            'effective_from' => $params->effective_from->toDateString(),
            'effective_to' => $params->effective_to?->toDateString(),
            'weekly_legal_hours' => (float) $params->weekly_legal_hours,
            'monthly_hours_divisor' => (float) $params->monthly_hours_divisor,
            'night_start_time' => $params->night_start_time,
            'night_end_time' => $params->night_end_time,
            'night_surcharge_percent' => (float) $params->night_surcharge_percent,
            'overtime_day_percent' => (float) $params->overtime_day_percent,
            'overtime_night_percent' => (float) $params->overtime_night_percent,
            'sunday_holiday_surcharge_percent' => (float) $params->sunday_holiday_surcharge_percent,
            'max_overtime_hours_per_day' => (float) $params->max_overtime_hours_per_day,
            'max_overtime_hours_per_week' => (float) $params->max_overtime_hours_per_week,
            'legal_reference' => $params->legal_reference,
        ];
    }

    /**
     * Descuento por inasistencia (dia habil esperado sin work_day_session cerrada/ajustada, §3.9).
     * Nunca aplica a operations (guarda explicita). Para fixed_daily el monto siempre es 0 (solo
     * trazabilidad: el dia ya no genera day_earnings al no existir sesion); para hourly_legal si hay
     * un monto real porque el salario base ya prorratea TODOS los dias calendario del periodo (§3.3).
     *
     * @param  \Illuminate\Support\Collection<string, array{date: string, discount?: bool, note?: string|null}>  $confirmationsByDate
     * @return array{total: float, detail: list<array<string, mixed>>}
     */
    protected function computeAbsenceDiscount(
        Employee $employee,
        Payroll $payroll,
        \Illuminate\Support\Collection $confirmationsByDate,
        ?User $actor,
    ): array {
        if ($employee->isPayrollByOperations()) {
            return ['total' => 0.0, 'detail' => []];
        }

        $scheduledDays = is_array($employee->scheduled_work_days) && $employee->scheduled_work_days !== []
            ? $employee->scheduled_work_days
            : Employee::DEFAULT_SCHEDULED_WORK_DAYS;

        $start = Carbon::parse($payroll->period_start);
        $end = Carbon::parse($payroll->period_end);
        $hireDate = $employee->hire_date ? Carbon::parse($employee->hire_date)->startOfDay() : null;

        $markedDates = WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->where('employee_id', $employee->id)
            ->whereBetween('work_date', [$payroll->period_start, $payroll->period_end])
            ->whereIn('status', [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED])
            ->get(['work_date'])
            ->map(fn ($s) => Carbon::parse($s->work_date)->toDateString())
            ->flip();

        $total = 0.0;
        $detail = [];
        $cursor = $start->copy();

        while ($cursor->lte($end)) {
            $dateString = $cursor->toDateString();
            $isExpected = in_array($cursor->isoWeekday(), $scheduledDays, true)
                && ($hireDate === null || $cursor->gte($hireDate))
                && ! $this->holidays->isHoliday($cursor);

            if ($isExpected && ! $markedDates->has($dateString)) {
                $params = $this->legalParams->resolve((int) $payroll->company_id, $cursor);
                $confirmation = $confirmationsByDate->get($dateString);
                $wantsDiscount = $confirmation['discount'] ?? $params->discount_unexcused_absences;
                $confirmed = (bool) $params->discount_unexcused_absences && (bool) $wantsDiscount;

                $amount = 0.0;
                if ($employee->isPayrollHourlyLegal()) {
                    $daysInMonth = $cursor->daysInMonth;
                    $amount = round(
                        ((float) $employee->base_salary / $daysInMonth) * ((float) $params->absence_discount_percent / 100),
                        2
                    );
                }

                $detail[] = [
                    'work_date' => $dateString,
                    'reason' => 'sin marcación',
                    'computed_amount' => $amount,
                    'amount' => $confirmed ? $amount : 0.0,
                    'confirmed' => $confirmed,
                    'note' => $confirmation['note'] ?? null,
                    'confirmed_by_user_id' => $confirmed ? $actor?->id : null,
                ];

                if ($confirmed) {
                    $total += $amount;
                }
            }

            $cursor->addDay();
        }

        return ['total' => round($total, 2), 'detail' => $detail];
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

            // Cada anticipo puede quedar total o parcialmente descontado; el saldo restante (si
            // queda) vuelve a estar disponible ("pendiente", sin nomina adjunta) para una nomina
            // futura, en vez de descontarse siempre por completo como antes.
            $attachedAdvances = Advance::query()
                ->withoutGlobalScopes()
                ->whereIn('payroll_employee_id', $payroll->payrollEmployees()->pluck('id'))
                ->get();

            foreach ($attachedAdvances as $advance) {
                $newRemaining = round((float) $advance->remaining_amount - (float) $advance->applied_amount, 2);

                if ($newRemaining <= 0.005) {
                    $advance->status = Advance::STATUS_DISCOUNTED;
                    $advance->remaining_amount = 0;
                    $advance->applied_amount = null;
                } else {
                    $advance->status = Advance::STATUS_PENDING;
                    $advance->remaining_amount = $newRemaining;
                    $advance->applied_amount = null;
                    $advance->payroll_employee_id = null;
                }

                $advance->save();
            }

            return $payroll->fresh();
        });
    }

    /**
     * Setting por empresa (§3.4): si esta activo, el calculo se bloquea cuando algun empleado
     * hourly_legal excede el tope legal de horas extra (diario o semanal), hasta que el admin
     * ajuste las horas. Por defecto false (solo se muestra la alerta, no bloquea).
     */
    protected function blockOvertimeOverLegalLimit(int $companyId): bool
    {
        return filter_var(
            Setting::get('payroll.block_overtime_over_legal_limit', false, $companyId),
            FILTER_VALIDATE_BOOLEAN
        );
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
