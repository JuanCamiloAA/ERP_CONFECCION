<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca los gastos que entraron por captura rapida y todavia no tienen descripcion real.
 *
 * La captura rapida guarda foto, monto y categoria en el taller; la descripcion se
 * completa despues desde el escritorio. Sin esta bandera el listado no puede distinguir
 * «gasto sin describir» de «gasto descrito escuetamente», que es justo lo que hace util
 * la pastilla «Completar».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->boolean('needs_detail')->default(false)->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('needs_detail');
        });
    }
};
