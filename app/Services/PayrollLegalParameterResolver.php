<?php

namespace App\Services;

use App\Models\PayrollLegalParameter;
use Carbon\Carbon;

/**
 * Resuelve el tramo de payroll_legal_parameters vigente para una empresa en una fecha exacta
 * (nunca la fecha del periodo completo, ver §3.1 del prompt de nomina legal). Prefiere el tramo
 * propio de la empresa sobre el global si ambos cubren la fecha. Cachea en memoria por instancia
 * (no persistente entre requests) para no repetir la consulta por cada sesion del periodo cuando
 * el mismo resolver se reutiliza dentro de un mismo calculo de nomina.
 */
class PayrollLegalParameterResolver
{
    /** @var array<string, PayrollLegalParameter> */
    protected array $cache = [];

    public function resolve(int $companyId, \DateTimeInterface $date): PayrollLegalParameter
    {
        $dateString = Carbon::parse($date)->toDateString();
        $key = "{$companyId}|{$dateString}";

        if (isset($this->cache[$key])) {
            return $this->cache[$key];
        }

        $companyRow = PayrollLegalParameter::query()
            ->where('company_id', $companyId)
            ->covering($dateString)
            ->orderByDesc('effective_from')
            ->first();

        $row = $companyRow ?? PayrollLegalParameter::query()
            ->whereNull('company_id')
            ->covering($dateString)
            ->orderByDesc('effective_from')
            ->first();

        if (! $row) {
            throw new \DomainException(
                "No hay parametros legales de nomina (payroll_legal_parameters) vigentes para la empresa {$companyId} en la fecha {$dateString}. ".
                'Configure un tramo en Parametros Legales de Nomina antes de calcular esta nomina.'
            );
        }

        return $this->cache[$key] = $row;
    }
}
