<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tercer estado de la produccion: `pagado`.
 *
 * Hasta ahora "ya se pago" solo se deducia de que la fecha cayera dentro de un periodo de
 * nomina pagada. Eso deja fuera los registros cargados despues de cerrar ese periodo y no
 * se ve en el listado. Con el estado explicito, al marcar la nomina como pagada la
 * produccion que se liquido queda cerrada y no puede volver a entrar en otra nomina.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `productions` MODIFY `status` ENUM('pendiente', 'confirmado', 'pagado') NOT NULL DEFAULT 'confirmado'");
    }

    public function down(): void
    {
        // Lo pagado vuelve a `confirmado`, que es el estado del que salio.
        DB::table('productions')->where('status', 'pagado')->update(['status' => 'confirmado']);

        DB::statement("ALTER TABLE `productions` MODIFY `status` ENUM('pendiente', 'confirmado') NOT NULL DEFAULT 'confirmado'");
    }
};
