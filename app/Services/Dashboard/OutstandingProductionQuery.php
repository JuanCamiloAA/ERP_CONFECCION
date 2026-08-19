<?php

namespace App\Services\Dashboard;

use App\Models\Payroll;
use App\Models\Production;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

final class OutstandingProductionQuery
{
    /**
     * Fuente única de verdad de "todavía se debe": producción que no está marcada como
     * `pagado` y cuya fecha tampoco cae dentro de un período de nómina ya pagada.
     *
     * Se conservan las dos condiciones a propósito. El estado cubre lo que cerró el pago
     * de la nómina; el período cubre lo histórico, anterior a que existiera ese estado.
     */
    public static function applyNotLiquidadedAsPaid(Builder $query): Builder
    {
        return $query
            ->where('productions.status', '!=', Production::STATUS_PAID)
            ->whereNotExists(self::criterio());
    }

    /**
     * El mismo criterio sobre una consulta cruda, para el constructor de widgets, que no
     * trabaja con modelos. Se comparte el cuerpo a propósito: si cambia qué cuenta como
     * pagado, tiene que cambiar en un solo lugar.
     */
    public static function applyNotLiquidadedAsPaidToQuery(QueryBuilder $query): QueryBuilder
    {
        return $query
            ->where('productions.status', '!=', Production::STATUS_PAID)
            ->whereNotExists(self::criterio());
    }

    private static function criterio(): Closure
    {
        return function ($sub) {
            $sub->from('payrolls')
                ->whereColumn('payrolls.company_id', 'productions.company_id')
                ->where('payrolls.status', Payroll::STATUS_PAID)
                ->whereNull('payrolls.deleted_at')
                ->whereColumn('payrolls.period_start', '<=', 'productions.date')
                ->whereColumn('payrolls.period_end', '>=', 'productions.date');
        };
    }
}
