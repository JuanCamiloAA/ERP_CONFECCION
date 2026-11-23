<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reprogramar una referencia para producir un lote nuevo sin crear otra referencia.
 *
 * - `references.lot_number`: programacion vigente (1, 2, 3…). Cantidad, pago por unidad y
 *   precios de operacion de la referencia son siempre los de esa programacion.
 * - `references.lot_started_at`: cuando arranco la programacion vigente (null = la primera,
 *   que arranca con la referencia).
 * - `productions.lot_number`: programacion a la que pertenece cada registro. El tope del
 *   lote solo cuenta los registros de la programacion vigente, por eso reprogramar deja el
 *   conteo en cero sin tocar lo ya producido.
 * - `reference_lots`: foto de cada programacion cerrada (cantidad, valor y precios por
 *   operacion de ese momento), para que el historial no dependa de los valores de hoy.
 *
 * Todo lo existente queda en la programacion 1, que es lo que ya era.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('references', function (Blueprint $table) {
            $table->unsignedInteger('lot_number')->default(1)->after('lot_total_quantity');
            $table->timestamp('lot_started_at')->nullable()->after('lot_number');
        });

        Schema::table('productions', function (Blueprint $table) {
            $table->unsignedInteger('lot_number')->default(1)->after('reference_id');
            // El tope del lote suma por referencia + programacion + operacion.
            $table->index(['reference_id', 'lot_number', 'operation_id'], 'productions_reference_lot_operation_index');
        });

        Schema::create('reference_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reference_id')->constrained('references')->cascadeOnDelete();
            $table->unsignedInteger('lot_number');
            $table->unsignedInteger('lot_total_quantity')->nullable();
            $table->decimal('payment_per_unit', 12, 2)->nullable();
            $table->decimal('operational_cost_per_unit', 12, 2)->default(0);
            // [{operation_id, name, price, estimated_minutes, difficulty_level}]
            $table->json('operations')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['reference_id', 'lot_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reference_lots');

        Schema::table('productions', function (Blueprint $table) {
            $table->dropIndex('productions_reference_lot_operation_index');
            $table->dropColumn('lot_number');
        });

        Schema::table('references', function (Blueprint $table) {
            $table->dropColumn(['lot_number', 'lot_started_at']);
        });
    }
};
