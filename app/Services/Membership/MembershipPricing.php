<?php

namespace App\Services\Membership;

use App\Models\BillingCycle;
use App\Models\MembershipPlan;

/**
 * El precio de un plan en un periodo de pago. Una sola fuente: ni el `.tsx`, ni la landing,
 * ni el cobro calculan precios por su cuenta.
 *
 *     precio mensual × meses × (100 − descuento) / 100
 *
 * Con descuento se redondea hacia arriba al siguiente mil, para que un trimestral no quede
 * en $427.500,00. Sin descuento NO se redondea: el mensual vale exactamente lo que dice el
 * plan, como hasta hoy.
 */
final class MembershipPricing
{
    /** Tope del descuento: un periodo nunca regala mas del 90 %. */
    public const MAX_DISCOUNT = 90;

    /** Null si el plan no tiene precio configurado. */
    public static function priceFor(MembershipPlan $plan, BillingCycle $cycle): ?int
    {
        if ($plan->price_monthly === null) {
            return null;
        }

        $monthlyCents = (int) round(((float) $plan->price_monthly) * 100);
        $months = max(1, (int) $cycle->months);
        $discount = min(self::MAX_DISCOUNT, max(0, (int) $cycle->discount_percent));

        if ($monthlyCents <= 0) {
            return 0;
        }

        if ($discount === 0) {
            return (int) round($monthlyCents * $months / 100);
        }

        // Centavos × porcentaje: diez mil unidades por peso. Se sube al siguiente mil de pesos.
        $raw = $monthlyCents * $months * (100 - $discount);
        $perThousandPesos = 1000 * 100 * 100;

        return intdiv($raw + $perThousandPesos - 1, $perThousandPesos) * 1000;
    }

    /** Lo que ese periodo vale al mes, para comparar periodos entre si. */
    public static function monthlyEquivalent(MembershipPlan $plan, BillingCycle $cycle): ?int
    {
        $price = self::priceFor($plan, $cycle);

        return $price === null ? null : intdiv($price, max(1, (int) $cycle->months));
    }

    /**
     * Precio del plan en cada periodo dado, para pintarlo sin calcularlo en el navegador.
     *
     * @param  iterable<BillingCycle>  $cycles
     * @return array<int, int|null> id del periodo => precio
     */
    public static function priceTable(MembershipPlan $plan, iterable $cycles): array
    {
        $prices = [];

        foreach ($cycles as $cycle) {
            $prices[$cycle->id] = self::priceFor($plan, $cycle);
        }

        return $prices;
    }
}
