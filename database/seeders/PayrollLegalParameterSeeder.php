<?php

namespace Database\Seeders;

use App\Models\PayrollLegalParameter;
use Illuminate\Database\Seeder;

/**
 * Tramos historicos globales (company_id = null) del marco legal colombiano de jornada, recargos
 * y horas extra — ver context/PROMPT_NOMINA_LEGAL_HORAS_RECARGOS.md §0. Cualquier empresa nueva
 * hereda esta cobertura desde 2023 sin configuracion manual; puede crear su propia fila para
 * sobreescribir un tramo solo para si misma (ver §4.6).
 *
 * Nota de implementacion: el prompt original describe "5 tramos" tomando solo los quiebres de
 * jornada/divisor (§0.1), pero el recargo dominical/festivo (§0.4) y el horario diurno/nocturno
 * (§0.2) cambian en fechas DISTINTAS (01-jul y 25-dic respectivamente) que no coinciden con las
 * de jornada (15-jul). Combinar todo en solo 5 filas produciria valores incorrectos para los dias
 * dentro de esas fechas cruzadas (ej. jornada de 44h con recargo dominical todavia en 75% en vez
 * de 80%). Por eso se sembraron las 9 filas no solapadas que resultan de unir los tres calendarios
 * de cambio — cada una sigue siendo 100% fiel a los porcentajes/horarios de §0, sin inventar nada.
 */
class PayrollLegalParameterSeeder extends Seeder
{
    public function run(): void
    {
        // Constantes en todos los tramos sembrados (§0.3: "No" cambio con la reforma).
        $nightSurcharge = 35.00;
        $overtimeDay = 25.00;
        $overtimeNight = 75.00;
        $maxOvertimeDay = 2.00;
        $maxOvertimeWeek = 12.00;

        $nightOld = ['start' => '21:00:00', 'end' => '06:00:00'];
        $nightNew = ['start' => '19:00:00', 'end' => '06:00:00'];

        $tramos = [
            [
                'effective_from' => '2023-01-01', 'effective_to' => '2023-07-14',
                'weekly_legal_hours' => 48.00, 'monthly_hours_divisor' => 240.00,
                'night' => $nightOld, 'sunday_holiday' => 75.00,
                'legal_reference' => 'CST arts. 158-172/179-180 (jornada 48h, previo a Ley 2101/2021)',
            ],
            [
                'effective_from' => '2023-07-15', 'effective_to' => '2024-07-14',
                'weekly_legal_hours' => 47.00, 'monthly_hours_divisor' => 235.00,
                'night' => $nightOld, 'sunday_holiday' => 75.00,
                'legal_reference' => 'Ley 2101 de 2021 — jornada 47h (tramo 15-jul-2023 a 14-jul-2024)',
            ],
            [
                'effective_from' => '2024-07-15', 'effective_to' => '2025-06-30',
                'weekly_legal_hours' => 46.00, 'monthly_hours_divisor' => 230.00,
                'night' => $nightOld, 'sunday_holiday' => 75.00,
                'legal_reference' => 'Ley 2101 de 2021 — jornada 46h (tramo 15-jul-2024 a 14-jul-2025)',
            ],
            [
                'effective_from' => '2025-07-01', 'effective_to' => '2025-07-14',
                'weekly_legal_hours' => 46.00, 'monthly_hours_divisor' => 230.00,
                'night' => $nightOld, 'sunday_holiday' => 80.00,
                'legal_reference' => 'Ley 2466 de 2025 art. 13 — recargo dominical/festivo sube a 80% desde 01-jul-2025',
            ],
            [
                'effective_from' => '2025-07-15', 'effective_to' => '2025-12-24',
                'weekly_legal_hours' => 44.00, 'monthly_hours_divisor' => 220.00,
                'night' => $nightOld, 'sunday_holiday' => 80.00,
                'legal_reference' => 'Ley 2101 de 2021 — jornada 44h (tramo 15-jul-2025 a 14-jul-2026)',
            ],
            [
                'effective_from' => '2025-12-25', 'effective_to' => '2026-06-30',
                'weekly_legal_hours' => 44.00, 'monthly_hours_divisor' => 220.00,
                'night' => $nightNew, 'sunday_holiday' => 80.00,
                'legal_reference' => 'Ley 2466 de 2025 art. 10 — jornada nocturna desde 7:00 p.m. (rige 25-dic-2025)',
            ],
            [
                'effective_from' => '2026-07-01', 'effective_to' => '2026-07-14',
                'weekly_legal_hours' => 44.00, 'monthly_hours_divisor' => 220.00,
                'night' => $nightNew, 'sunday_holiday' => 90.00,
                'legal_reference' => 'Ley 2466 de 2025 art. 13 — recargo dominical/festivo sube a 90% desde 01-jul-2026',
            ],
            [
                'effective_from' => '2026-07-15', 'effective_to' => '2027-06-30',
                'weekly_legal_hours' => 42.00, 'monthly_hours_divisor' => 210.00,
                'night' => $nightNew, 'sunday_holiday' => 90.00,
                'legal_reference' => 'Ley 2101 de 2021 — jornada 42h, vigente desde 15-jul-2026 (tramo actual)',
            ],
            [
                'effective_from' => '2027-07-01', 'effective_to' => null,
                'weekly_legal_hours' => 42.00, 'monthly_hours_divisor' => 210.00,
                'night' => $nightNew, 'sunday_holiday' => 100.00,
                'legal_reference' => 'Ley 2466 de 2025 art. 13 — recargo dominical/festivo llega a 100% desde 01-jul-2027',
            ],
        ];

        foreach ($tramos as $t) {
            PayrollLegalParameter::query()->updateOrCreate(
                [
                    'company_id' => null,
                    'effective_from' => $t['effective_from'],
                ],
                [
                    'effective_to' => $t['effective_to'],
                    'weekly_legal_hours' => $t['weekly_legal_hours'],
                    'monthly_hours_divisor' => $t['monthly_hours_divisor'],
                    'night_start_time' => $t['night']['start'],
                    'night_end_time' => $t['night']['end'],
                    'night_surcharge_percent' => $nightSurcharge,
                    'overtime_day_percent' => $overtimeDay,
                    'overtime_night_percent' => $overtimeNight,
                    'sunday_holiday_surcharge_percent' => $t['sunday_holiday'],
                    'max_overtime_hours_per_day' => $maxOvertimeDay,
                    'max_overtime_hours_per_week' => $maxOvertimeWeek,
                    'discount_unexcused_absences' => false,
                    'absence_discount_percent' => 100.00,
                    'legal_reference' => $t['legal_reference'],
                ],
            );
        }
    }
}
