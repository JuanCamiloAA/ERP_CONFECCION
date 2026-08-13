<?php

use App\Models\Advance;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('advances', function (Blueprint $table) {
            // Saldo aun no descontado del anticipo (empieza igual a "amount"; baja con cada
            // nomina que lo descuenta parcialmente; llega a 0 cuando queda totalmente pagado).
            $table->decimal('remaining_amount', 14, 2)->nullable()->after('amount');
            // Monto que se va a descontar en la nomina a la que esta actualmente adjunto
            // (payroll_employee_id); null cuando el anticipo no esta adjunto a ninguna nomina abierta.
            $table->decimal('applied_amount', 14, 2)->nullable()->after('remaining_amount');
        });

        // Backfill: bajo el comportamiento anterior (todo o nada), "descontado" siempre significaba
        // 100% pagado y "pendiente" siempre significaba 0% pagado, sin importar si ya estaba
        // adjunto a una nomina en borrador.
        DB::table('advances')->where('status', Advance::STATUS_DISCOUNTED)->update(['remaining_amount' => 0]);
        DB::table('advances')->where('status', Advance::STATUS_PENDING)->update([
            'remaining_amount' => DB::raw('amount'),
        ]);
        DB::table('advances')
            ->where('status', Advance::STATUS_PENDING)
            ->whereNotNull('payroll_employee_id')
            ->update(['applied_amount' => DB::raw('amount')]);

        Schema::table('advances', function (Blueprint $table) {
            $table->decimal('remaining_amount', 14, 2)->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('advances', function (Blueprint $table) {
            $table->dropColumn(['remaining_amount', 'applied_amount']);
        });
    }
};
