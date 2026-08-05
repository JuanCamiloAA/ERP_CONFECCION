<?php

namespace App\Support;

use App\Models\Company;

/**
 * Convierte minutos estandar de una operacion en un grado de dificultad (1 a 5) usando
 * los umbrales configurados por cada empresa (Mi empresa > Dificultad por minutos).
 */
class OperationDifficulty
{
    /**
     * Limites ascendentes en minutos para los niveles 1 a 4; por encima del ultimo, nivel 5.
     */
    public const DEFAULT_THRESHOLDS = [3, 7, 15, 25];

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public static function thresholdsFor(?Company $company): array
    {
        $raw = $company?->settings['difficulty_minute_thresholds'] ?? null;

        if (! is_array($raw) || count($raw) !== 4) {
            return self::DEFAULT_THRESHOLDS;
        }

        $values = array_values($raw);
        foreach ($values as $v) {
            if (! is_numeric($v) || (float) $v <= 0) {
                return self::DEFAULT_THRESHOLDS;
            }
        }

        $values = array_map(fn ($v) => (float) $v, $values);
        sort($values);

        return $values;
    }

    /**
     * @param  array<int, float>  $thresholds  Ascendente, tal como retorna thresholdsFor().
     */
    public static function levelFromMinutes(float $minutes, array $thresholds): int
    {
        foreach (array_values($thresholds) as $index => $limit) {
            if ($minutes <= $limit) {
                return $index + 1;
            }
        }

        return 5;
    }
}
