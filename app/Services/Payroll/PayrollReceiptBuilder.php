<?php

namespace App\Services\Payroll;

use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Support\ReceiptFormat as F;
use Illuminate\Support\Carbon;

/**
 * Arma el comprobante de un empleado: las mismas cifras que muestra `Payrolls/Receipt.tsx`.
 *
 * La pantalla calcula bruto, descuentos y saldo de anticipos en el navegador. El PDF que
 * viaja adjunto al correo no puede ejecutar ese codigo, asi que la cuenta se rehace aqui.
 * Cualquier cambio en la formula de `lib/payrolls.ts` tiene que reflejarse en este archivo:
 * son las dos caras del mismo documento y un empleado puede compararlas.
 */
class PayrollReceiptBuilder
{
    private const MODE_LABEL = [
        'operations' => 'Pago por operación',
        'fixed_daily' => 'Salario diario por jornada',
        'hourly_legal' => 'Jornada legal por horas',
    ];

    public function __construct(private PayrollPeriodData $periodData) {}

    /**
     * @return array<string, mixed>
     */
    public function build(Payroll $payroll, PayrollEmployee $row): array
    {
        $payroll->loadMissing('company:id,name,nit,address,phone,logo');
        $row->loadMissing([
            'employee',
            'employee.bank:id,name,code',
            'advances',
            'adjustments.payrollConcept:id,name,code',
        ]);

        $employeeId = (int) $row->employee_id;
        $sessions = $this->periodData->workSessionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [];
        $productions = $this->periodData->productionsFor($payroll, [$employeeId])[(string) $employeeId] ?? [];

        $mode = (string) ($row->employee->payroll_mode ?? 'operations');
        $breakdown = is_array($row->legal_hours_breakdown) ? $row->legal_hours_breakdown : null;

        $legalSubtotal = (float) ($row->legal_hourly_subtotal ?? 0);
        $dailySubtotal = (float) ($row->daily_work_subtotal ?? 0);
        $hasLegal = $legalSubtotal > 0 && $breakdown !== null;
        $hasDaily = $dailySubtotal > 0;

        $gross = (float) ($row->production_total ?? 0)
            + $dailySubtotal
            + $legalSubtotal
            + (float) ($row->adjustments_subtotal ?? 0);

        $deductionsTotal = collect(is_array($row->deductions) ? $row->deductions : [])
            ->sum(fn ($d) => (float) ($d['amount'] ?? 0));

        $delivered = collect($row->advances ?? [])->sum(fn ($a) => (float) ($a->remaining_amount ?? 0));
        $applied = (float) ($row->advances_discount ?? 0);
        $absence = (float) ($row->absence_discount_total ?? 0);
        $discountTotal = $deductionsTotal + $applied + $absence;

        $minutes = collect($sessions)->sum(fn ($s) => (float) ($s->duration_minutes ?? 0));
        $units = collect($productions)->sum(fn ($p) => (float) ($p->quantity ?? 0));
        $prodValue = collect($productions)->sum(fn ($p) => (float) ($p->total_value ?? 0));

        $periodText = F::date($payroll->period_start).' — '.F::date($payroll->period_end);
        $companyName = (string) ($payroll->company->name ?? 'Empresa');
        $employeeName = trim(($row->employee->first_name ?? '').' '.($row->employee->last_name ?? '')) ?: 'Empleado';

        return [
            'company' => [
                'name' => $companyName,
                'initial' => mb_strtoupper(mb_substr($companyName, 0, 1)),
                'nit' => $payroll->company->nit ?? null,
                'address' => $payroll->company->address ?? null,
                'phone' => $payroll->company->phone ?? null,
            ],
            'payroll' => [
                'name' => (string) $payroll->name,
                'period_text' => $periodText,
                'period_start' => F::date($payroll->period_start),
                'period_end' => F::date($payroll->period_end),
            ],
            'employee' => [
                'name' => $employeeName,
                'document_type' => $row->employee->document_type ?? 'Documento',
                'document_number' => $row->employee->document_number ?? '—',
                'email' => $row->employee->email ?? null,
                'mode' => $mode,
                'mode_label' => self::MODE_LABEL[$mode] ?? self::MODE_LABEL['operations'],
                'bank_name' => $row->employee->bank->name ?? null,
                'bank_account' => $row->employee->bank_account_number ?? null,
            ],
            'stats' => [
                'is_operations' => $mode === 'operations',
                'units' => $units,
                'sessions_count' => count($sessions),
                'minutes' => $minutes,
                'hours' => F::hours($minutes),
                'gross' => $gross,
            ],
            'productions' => $this->productionRows($productions),
            'sessions' => $this->sessionRows($sessions, $row, $breakdown),
            'legal' => $hasLegal ? [
                'base_salary_earned' => (float) ($breakdown['base_salary_earned'] ?? 0),
                'night' => (float) ($breakdown['night_surcharge_amount'] ?? 0),
                'sunday' => (float) ($breakdown['sunday_holiday_surcharge_amount'] ?? 0),
                'overtime' => (float) ($breakdown['overtime_amount'] ?? 0),
            ] : null,
            'earnings' => [
                'production_total' => (float) ($row->production_total ?? 0),
                'daily' => $dailySubtotal,
                'legal' => $legalSubtotal,
                'adjustments' => (float) ($row->adjustments_subtotal ?? 0),
                'gross' => $gross,
                'has_daily' => $hasDaily,
                'has_legal' => $hasLegal,
            ],
            'discounts' => [
                'deductions' => $deductionsTotal,
                'delivered' => $delivered,
                'applied' => $applied,
                'absence' => $absence,
                'total' => $discountTotal,
            ],
            'totals' => [
                'prod_units' => $units,
                'prod_value' => $prodValue,
                'session_minutes' => $minutes,
                'session_amount' => $legalSubtotal ?: $dailySubtotal,
            ],
            'net' => (float) ($row->net_payment ?? 0),
            // Anticipo entregado que no alcanzo a descontarse: pasa al periodo siguiente.
            'carried' => max(0, $delivered - $applied),
            'over_discount' => $discountTotal > $gross,
            'over_discount_diff' => max(0, $discountTotal - $gross),
        ];
    }

    /**
     * @param  array<int, mixed>  $productions
     * @return list<array<string, mixed>>
     */
    private function productionRows(array $productions): array
    {
        return collect($productions)->map(fn ($p) => [
            'date' => F::date($p->date),
            'reference_code' => $p->reference->code ?? null,
            'reference_name' => $p->reference->name ?? null,
            'operation' => $p->operation->name ?? '—',
            'quantity' => (float) ($p->quantity ?? 0),
            'value' => (float) ($p->total_value ?? 0),
        ])->all();
    }

    /**
     * El valor del dia sale del retrato legal cuando existe; si no, de la liquidacion diaria.
     *
     * @param  array<int, mixed>  $sessions
     * @param  array<string, mixed>|null  $breakdown
     * @return list<array<string, mixed>>
     */
    private function sessionRows(array $sessions, PayrollEmployee $row, ?array $breakdown): array
    {
        $legalBySession = collect($breakdown['daily_detail'] ?? [])->keyBy(fn ($d) => (int) ($d['session_id'] ?? 0));
        $dailyBySession = collect(is_array($row->validated_work_days) ? $row->validated_work_days : [])
            ->keyBy(fn ($d) => (int) ($d['session_id'] ?? 0));

        return collect($sessions)->map(function ($session) use ($legalBySession, $dailyBySession) {
            $id = (int) $session->id;
            $legal = $legalBySession->get($id);
            $daily = $dailyBySession->get($id);

            $amount = match (true) {
                $legal !== null => (float) ($legal['day_amount'] ?? 0),
                $daily !== null => (float) ($daily['day_earnings'] ?? 0),
                default => null,
            };

            $special = $legal !== null
                ? (bool) ($legal['is_sunday_holiday'] ?? false)
                : Carbon::parse($session->work_date)->isSunday();

            $minutes = (float) ($session->duration_minutes ?? 0);

            return [
                'date' => F::date($session->work_date),
                'is_special' => $special,
                'clock_in' => F::clock($session->clock_in_at),
                'clock_out' => F::clock($session->clock_out_at),
                'minutes' => $minutes,
                'hours' => F::hours($minutes),
                'amount' => $amount,
            ];
        })->all();
    }
}
