<?php

use App\Models\Reference;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Migrations\Migration;

/**
 * Repara el costo operacional de las referencias cerradas.
 *
 * El calculo anterior sumaba solo las lineas activas del detalle. Al completarse el lote,
 * ReferenceLotCompletion inactiva la referencia y todas sus lineas, de modo que esas
 * referencias quedaron con costo 0 —y con el, un margen falso en el comparativo—.
 *
 * El costo pasa a salir de todo el detalle, activo o no, asi que aqui se recalculan todas
 * las referencias con la regla nueva.
 */
return new class extends Migration
{
    public function up(): void
    {
        Reference::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->chunkById(200, function ($referencias) {
                foreach ($referencias as $referencia) {
                    // Es un dato derivado que se corrige, no una edicion del usuario.
                    $referencia->timestamps = false;
                    $referencia->refreshOperationalCost();
                }
            });
    }

    public function down(): void
    {
        // El valor anterior era el mismo dato mal calculado: no hay a que volver.
    }
};
