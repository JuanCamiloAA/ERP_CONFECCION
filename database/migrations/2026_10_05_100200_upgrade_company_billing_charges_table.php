<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que necesita un cobro para poder liquidarse sin cobrar dos veces.
 *
 * - `reference` (MEM-...): referencia propia y unica. Es lo que viaja a la pasarela y lo que
 *   hace idempotente la liquidacion: un evento repetido encuentra el cobro ya pagado.
 * - `period_*`: que periodo pago. El cobro es un hecho historico; no se deduce del plan.
 * - `method`, `attempts`, `failure_reason`, `paid_at`, `created_by_user_id`: quien, como y
 *   por que no paso.
 *
 * `status` deja de ser `enum`: los estados nuevos (anulado) no deben pedir otro ALTER.
 * `gateway_reference` conserva su significado: el id de la transaccion en la pasarela.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_billing_charges', function (Blueprint $table) {
            $table->string('status', 20)->default('pendiente')->change();
        });

        Schema::table('company_billing_charges', function (Blueprint $table) {
            $table->foreignId('billing_cycle_id')->nullable()->after('membership_plan_id')
                ->constrained('billing_cycles')->nullOnDelete();
            $table->string('reference', 60)->nullable()->unique()->after('concept');
            $table->string('method', 20)->nullable()->after('status');
            $table->dateTime('period_starts_at')->nullable()->after('method');
            $table->dateTime('period_ends_at')->nullable()->after('period_starts_at');
            $table->unsignedSmallInteger('attempts')->default(0)->after('gateway_reference');
            $table->string('failure_reason')->nullable()->after('attempts');
            $table->dateTime('paid_at')->nullable()->after('charged_at');
            // null = lo hizo el sistema (renovacion automatica).
            $table->foreignId('created_by_user_id')->nullable()->after('paid_at')
                ->constrained('users')->nullOnDelete();

            $table->index('gateway_reference');
            $table->index(['status', 'created_at']);
        });

        // Los cobros que ya existen salieron del alta en linea: se pagaron por el checkout.
        DB::table('company_billing_charges')
            ->whereNotNull('gateway_reference')
            ->update(['method' => 'enlace']);

        DB::table('company_billing_charges')
            ->where('status', 'pagado')
            ->whereNull('paid_at')
            ->update(['paid_at' => DB::raw('charged_at')]);
    }

    public function down(): void
    {
        Schema::table('company_billing_charges', function (Blueprint $table) {
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['gateway_reference']);
            $table->dropUnique(['reference']);
            $table->dropConstrainedForeignId('billing_cycle_id');
            $table->dropConstrainedForeignId('created_by_user_id');
            $table->dropColumn([
                'reference', 'method', 'period_starts_at', 'period_ends_at',
                'attempts', 'failure_reason', 'paid_at',
            ]);
        });

        // Lo que no quepa en el enum anterior se lleva a «fallido» antes de encogerlo.
        DB::table('company_billing_charges')
            ->whereNotIn('status', ['pendiente', 'pagado', 'fallido'])
            ->update(['status' => 'fallido']);

        DB::statement("ALTER TABLE `company_billing_charges` MODIFY `status` ENUM('pendiente','pagado','fallido') NOT NULL DEFAULT 'pendiente'");
    }
};
