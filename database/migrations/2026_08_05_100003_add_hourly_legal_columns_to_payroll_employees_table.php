<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            // devengo total de la modalidad hourly_legal en el periodo (salario base proporcional +
            // recargos + horas extra); en 0 para empleados que no son hourly_legal, misma convencion
            // que production_total/daily_work_subtotal
            $table->decimal('legal_hourly_subtotal', 12, 2)->default(0)->after('daily_work_subtotal');

            // snapshot de auditoria por liquidacion: minutos por tipo, tarifa aplicada, montos de
            // recargos/extras y los parametros legales usados (ver PayrollCalculationService)
            $table->json('legal_hours_breakdown')->nullable()->after('legal_hourly_subtotal');

            // advertencias de topes legales de horas extra excedidos en el periodo (no bloquea el
            // calculo salvo que el Setting payroll.block_overtime_over_legal_limit este activo)
            $table->json('overtime_limit_alerts')->nullable()->after('legal_hours_breakdown');

            // monto descontado por inasistencia sin marcar (dias habiles esperados sin sesion cerrada),
            // ya confirmado por el admin; aplica a fixed_daily (informativo, queda en 0) y hourly_legal
            $table->decimal('absence_discount_total', 12, 2)->default(0)->after('overtime_limit_alerts');

            // snapshot de auditoria de los dias candidatos, monto y confirmacion/justificacion del admin
            $table->json('absence_discount_detail')->nullable()->after('absence_discount_total');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->dropColumn([
                'legal_hourly_subtotal',
                'legal_hours_breakdown',
                'overtime_limit_alerts',
                'absence_discount_total',
                'absence_discount_detail',
            ]);
        });
    }
};
