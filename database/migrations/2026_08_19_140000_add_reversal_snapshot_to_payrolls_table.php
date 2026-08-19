<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Retrato del estado previo al pago de una nomina.
 *
 * Marcar una nomina como pagada consume anticipos (baja su saldo, los cierra) y cierra la
 * produccion liquidada. Ninguna de las dos cosas se puede deducir hacia atras: del saldo de
 * un anticipo ya no se sabe cuanto se le desconto, y de una produccion en `pagado` no se
 * sabe si antes estaba pendiente o confirmada.
 *
 * Aqui se guarda ese estado justo antes de tocarlo, para que el super usuario pueda deshacer
 * el cierre cuando la empresa lo hizo por error y rehacer la nomina desde cero.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->json('reversal_snapshot')->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn('reversal_snapshot');
        });
    }
};
