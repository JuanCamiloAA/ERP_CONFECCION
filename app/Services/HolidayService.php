<?php

namespace App\Services;

use App\Models\Holiday;
use Carbon\Carbon;

/**
 * Festivos colombianos: algoritmo determinístico (Pascua via Meeus/Jones/Butcher + Ley 51 de 1983
 * "Ley Emiliani", ver context/PROMPT_NOMINA_LEGAL_HORAS_RECARGOS.md §2.3). Los festivos calculados
 * se guardan con source=calculated; el admin puede agregar/quitar festivos manuales (source=manual)
 * para casos puntuales que el algoritmo no cubre (ej. Ley 2578 de 2026, ver HolidaySeeder).
 */
class HolidayService
{
    /**
     * [mes, dia, nombre] — no se trasladan aunque caigan entre semana (Ley 51/1983, excepciones).
     */
    protected const FIXED_NOT_SHIFTED = [
        [1, 1, 'Año Nuevo'],
        [5, 1, 'Día del Trabajo'],
        [7, 20, 'Día de la Independencia'],
        [8, 7, 'Batalla de Boyacá'],
        [12, 8, 'Inmaculada Concepción'],
        [12, 25, 'Navidad'],
    ];

    /**
     * [mes, dia, nombre] — se trasladan al lunes siguiente si no caen en lunes.
     */
    protected const FIXED_SHIFTED = [
        [1, 6, 'Reyes Magos'],
        [3, 19, 'San José'],
        [6, 29, 'San Pedro y San Pablo'],
        [8, 15, 'Asunción de la Virgen'],
        [10, 12, 'Día de la Raza'],
        [11, 1, 'Todos los Santos'],
        [11, 11, 'Independencia de Cartagena'],
    ];

    public function syncYear(int $year, string $countryCode = 'CO'): int
    {
        // Dos festivos distintos pueden coincidir en la misma fecha al trasladarse (ej. San Pedro y
        // San Pablo y Sagrado Corazon de Jesus caen ambos el 2025-06-30): se combinan los nombres en
        // una sola fila en vez de que el segundo pise silenciosamente el nombre del primero.
        $byDate = [];
        foreach ($this->buildYear($year) as $row) {
            if (isset($byDate[$row['date']])) {
                $existingNames = explode(' / ', $byDate[$row['date']]['name']);
                if (! in_array($row['name'], $existingNames, true)) {
                    $byDate[$row['date']]['name'] .= ' / '.$row['name'];
                }
                $byDate[$row['date']]['shifted'] = $byDate[$row['date']]['shifted'] || $row['shifted'];
            } else {
                $byDate[$row['date']] = $row;
            }
        }

        $count = 0;
        foreach ($byDate as $row) {
            Holiday::query()->updateOrCreate(
                ['country_code' => $countryCode, 'date' => $row['date']],
                [
                    'name' => $row['name'],
                    'is_emiliani_shifted' => $row['shifted'],
                    'source' => Holiday::SOURCE_CALCULATED,
                ],
            );
            $count++;
        }

        return $count;
    }

    public function isHolidayOrSunday(Carbon $date, string $countryCode = 'CO'): bool
    {
        if ($date->isSunday()) {
            return true;
        }

        return $this->isHoliday($date, $countryCode);
    }

    /**
     * Solo festivos de la tabla holidays (sin el atajo de domingo de isHolidayOrSunday). Usado para
     * detectar "dia habil esperado sin marcar" (§3.9), donde el domingo ya se excluye normalmente
     * por no estar en employee.scheduled_work_days, no por ser festivo.
     */
    public function isHoliday(Carbon $date, string $countryCode = 'CO'): bool
    {
        return Holiday::query()
            ->where('country_code', $countryCode)
            ->whereDate('date', $date->toDateString())
            ->exists();
    }

    /**
     * @return list<array{date: string, name: string, shifted: bool}>
     */
    protected function buildYear(int $year): array
    {
        $rows = [];

        foreach (self::FIXED_NOT_SHIFTED as [$month, $day, $name]) {
            $rows[] = [
                'date' => Carbon::create($year, $month, $day)->toDateString(),
                'name' => $name,
                'shifted' => false,
            ];
        }

        foreach (self::FIXED_SHIFTED as [$month, $day, $name]) {
            $shifted = $this->shiftToMonday(Carbon::create($year, $month, $day));
            $rows[] = [
                'date' => $shifted['date']->toDateString(),
                'name' => $name,
                'shifted' => $shifted['shifted'],
            ];
        }

        $easter = $this->easterSunday($year);

        $rows[] = [
            'date' => $easter->copy()->subDays(3)->toDateString(),
            'name' => 'Jueves Santo',
            'shifted' => false,
        ];
        $rows[] = [
            'date' => $easter->copy()->subDays(2)->toDateString(),
            'name' => 'Viernes Santo',
            'shifted' => false,
        ];

        foreach ([
            [39, 'Ascensión del Señor'],
            [60, 'Corpus Christi'],
            [68, 'Sagrado Corazón de Jesús'],
        ] as [$offsetDays, $name]) {
            $shifted = $this->shiftToMonday($easter->copy()->addDays($offsetDays));
            $rows[] = [
                'date' => $shifted['date']->toDateString(),
                'name' => $name,
                'shifted' => $shifted['shifted'],
            ];
        }

        return $rows;
    }

    /**
     * @return array{date: Carbon, shifted: bool}
     */
    protected function shiftToMonday(Carbon $date): array
    {
        if ($date->isMonday()) {
            return ['date' => $date, 'shifted' => false];
        }

        return ['date' => $date->copy()->next(Carbon::MONDAY), 'shifted' => true];
    }

    /**
     * Domingo de Pascua (calendario gregoriano) via el algoritmo de Meeus/Jones/Butcher.
     * Portable en cualquier build de PHP (no depende de la extension calendar / easter_date()).
     */
    protected function easterSunday(int $year): Carbon
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return Carbon::create($year, $month, $day);
    }
}
