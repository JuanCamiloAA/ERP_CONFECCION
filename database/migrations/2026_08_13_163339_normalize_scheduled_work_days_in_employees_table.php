<?php

use App\Models\Employee;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Repara employees.scheduled_work_days guardados como cadenas (["1","2",...]).
     *
     * El formulario de empleados envia FormData (forceFormData por la foto) y FormData convierte
     * todo a texto. La regla de validacion "integer" acepta cadenas numericas, asi que se
     * almacenaban como texto. Cualquier comparacion estricta contra Carbon::isoWeekday() (int)
     * fallaba, dejando al empleado sin dias laborables: no se detectaba ninguna inasistencia y
     * el selector de dias aparecia vacio al editarlo.
     *
     * El modelo ya normaliza al leer y al escribir; esto limpia ademas lo ya almacenado para que
     * el dato crudo en base de datos sea consistente.
     */
    public function up(): void
    {
        DB::table('employees')
            ->whereNotNull('scheduled_work_days')
            ->orderBy('id')
            ->chunkById(200, function ($employees): void {
                foreach ($employees as $employee) {
                    $decoded = json_decode((string) $employee->scheduled_work_days, true);

                    if (! is_array($decoded)) {
                        continue;
                    }

                    $normalized = [];
                    foreach ($decoded as $day) {
                        if (! is_scalar($day)) {
                            continue;
                        }
                        $int = (int) $day;
                        if ($int >= 1 && $int <= 7 && ! in_array($int, $normalized, true)) {
                            $normalized[] = $int;
                        }
                    }
                    sort($normalized);

                    if ($normalized === []) {
                        $normalized = Employee::DEFAULT_SCHEDULED_WORK_DAYS;
                    }

                    $encoded = json_encode($normalized);

                    if ($encoded !== $employee->scheduled_work_days) {
                        DB::table('employees')->where('id', $employee->id)->update([
                            'scheduled_work_days' => $encoded,
                        ]);
                    }
                }
            });
    }

    /**
     * Normalizacion de datos: no hay estado anterior al cual volver de forma significativa.
     */
    public function down(): void
    {
        // Intencionalmente vacio.
    }
};
