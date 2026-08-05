<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // jornada ordinaria diaria pactada (modalidad hourly_legal); minutos que la excedan en un
            // work_date son candidatos a hora extra (sujeto tambien al tope semanal, PayrollCalculationService)
            $table->decimal('ordinary_hours_per_day', 4, 2)->default(8.00)->after('minutes_per_full_workday');

            // cargos de direccion/confianza/manejo u otra excepcion del art. 162 CST: sus horas nunca
            // generan "extra" (solo recargo nocturno/dominical si aplica), aunque excedan la jornada
            $table->boolean('is_exempt_from_overtime')->default(false)->after('ordinary_hours_per_day');

            // dias ISO de la semana (1=lunes...7=domingo) en que se espera marcacion de jornada;
            // aplica a fixed_daily y hourly_legal (usesWorkDaySessions()), nunca a operations
            $table->json('scheduled_work_days')->nullable()->after('is_exempt_from_overtime');
        });

        // default explicito lunes-sabado para filas existentes (el default de columna JSON no aplica
        // retroactivamente en todos los motores igual que un escalar, se fija aqui para dejarlo consistente)
        \Illuminate\Support\Facades\DB::table('employees')->whereNull('scheduled_work_days')->update([
            'scheduled_work_days' => json_encode([1, 2, 3, 4, 5, 6]),
        ]);
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['ordinary_hours_per_day', 'is_exempt_from_overtime', 'scheduled_work_days']);
        });
    }
};
