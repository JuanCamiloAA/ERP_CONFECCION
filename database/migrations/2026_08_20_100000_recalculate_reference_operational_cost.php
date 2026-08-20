<?php

use App\Models\Reference;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Migrations\Migration;

/**
 * El costo operacional unitario dejo de ser una foto del momento de crear la referencia y
 * pasa a salir del detalle de operaciones activas.
 *
 * Las referencias que ya existen conservarian el valor viejo hasta que alguien les tocara
 * una linea, asi que se recalculan todas de una vez. Sin sesion no hay filtro de empresa,
 * pero se desactiva el scope de forma explicita para que valga en cualquier contexto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Reference::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->chunkById(200, function ($referencias) {
                foreach ($referencias as $referencia) {
                    // Es un dato derivado que se corrige, no una edicion del usuario: no
                    // tiene por que mover la fecha de modificacion de la referencia.
                    $referencia->timestamps = false;
                    $referencia->refreshOperationalCost();
                }
            });
    }

    public function down(): void
    {
        // El costo anterior era una foto que no se guardaba en ningun otro lado, asi que
        // no hay valor al que volver. El derivado queda, que es correcto igual.
    }
};
