<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de cobros de la membresia.
 *
 * Nace vacia: mientras no haya pasarela conectada no se inventan filas de ejemplo, y la
 * pantalla muestra su estado vacio. Soporte puede insertar cobros hechos por fuera para
 * que la empresa los vea.
 *
 * El plan queda referenciado con `nullOnDelete` porque un cobro es un hecho historico: si
 * el plan se borra del catalogo, el cobro sigue habiendo ocurrido y su importe y concepto
 * —que se guardan en la fila— lo siguen describiendo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_billing_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_plan_id')->nullable()->constrained('membership_plans')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('COP');
            $table->string('concept');
            $table->enum('status', ['pendiente', 'pagado', 'fallido'])->default('pendiente');
            $table->string('gateway_reference')->nullable();
            $table->dateTime('charged_at')->nullable();
            $table->timestamps();

            // El listado siempre es «los cobros de esta empresa, del mas reciente al mas viejo».
            $table->index(['company_id', 'charged_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_billing_charges');
    }
};
