<?php

namespace App\Services\Payroll;

use App\Models\Payroll;
use App\Models\Production;
use App\Models\Scopes\CompanyScope;
use App\Models\WorkDaySession;

/**
 * Jornadas y produccion liquidable de un periodo, agrupadas por empleado.
 *
 * Vivia dentro de PayrollController, que era su unico consumidor. El comprobante enviado
 * por correo se arma en segundo plano, sin request ni controlador, y necesita exactamente
 * los mismos datos: si se copiaban, el PDF del correo podia terminar contando jornadas
 * distintas a las de la pantalla.
 */
class PayrollPeriodData
{
    /**
     * @param  int[]  $employeeIds
     * @return array<string, mixed>
     */
    public function workSessionsFor(Payroll $payroll, array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        return WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->whereBetween('work_date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->whereIn('employee_id', $employeeIds)
            ->orderBy('work_date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($s) => (string) $s->employee_id)
            ->map(fn ($sessions) => $sessions->values()->all())
            ->all();
    }

    /**
     * @param  int[]  $employeeIds
     * @return array<string, mixed>
     */
    public function productionsFor(Payroll $payroll, array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        return Production::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with(['reference:id,code,name', 'operation:id,name'])
            ->whereBetween('date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->whereIn('status', Production::PAYABLE_STATUSES)
            ->where(function ($q) use ($payroll) {
                $cid = (int) $payroll->company_id;
                $q->where('company_id', $cid)
                    ->orWhereHas('reference', fn ($r) => $r->where('company_id', $cid));
            })
            ->whereIn('employee_id', $employeeIds)
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($p) => (string) $p->employee_id)
            ->map(fn ($rows) => $rows->values()->all())
            ->all();
    }
}
