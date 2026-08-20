<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La pantalla busca el ultimo lote de cada tipo (MAX(id) agrupado por type) para mostrar
 * en que va cada entidad. Sin indice, esa consulta recorre la tabla entera cada vez que
 * se abre la importacion.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('data_import_batches', function (Blueprint $table) {
            $table->index(['type', 'id'], 'data_import_batches_type_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('data_import_batches', function (Blueprint $table) {
            $table->dropIndex('data_import_batches_type_id_index');
        });
    }
};
