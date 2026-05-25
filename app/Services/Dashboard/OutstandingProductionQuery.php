<?php

namespace App\Services\Dashboard;

use App\Models\Payroll;
use Illuminate\Database\Eloquent\Builder;

final class OutstandingProductionQuery
{
    /**
     * Fuente única de verdad: producción pendiente de pago = fecha de producción que no cae
     * dentro de ningún período de nómina marcada como `pagado` en la misma empresa
     * (equivale a Payroll::paidPeriodCoversDate a nivel de colección/listado masivo).
     */
    public static function applyNotLiquidadedAsPaid(Builder $query): Builder
    {
        return $query->whereNotExists(function ($sub) {
            $sub->from('payrolls')
                ->whereColumn('payrolls.company_id', 'productions.company_id')
                ->where('payrolls.status', Payroll::STATUS_PAID)
                ->whereNull('payrolls.deleted_at')
                ->whereColumn('payrolls.period_start', '<=', 'productions.date')
                ->whereColumn('payrolls.period_end', '>=', 'productions.date');
        });
    }
}
