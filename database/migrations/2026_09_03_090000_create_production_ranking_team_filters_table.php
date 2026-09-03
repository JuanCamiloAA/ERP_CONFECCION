<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Filtro de fechas que un administrador fija para todo el ranking de su empresa.
 *
 * Es uno solo por empresa —de ahi el unico sobre `company_id`—: la pantalla lo muestra en
 * un banner y sirve de valor inicial a quien abre el ranking sin traer fechas propias en
 * la URL. Se guarda quien lo puso para poder decirlo en ese banner.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_ranking_team_filters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->date('date_start');
            $table->date('date_end');
            // Si se borra el usuario el filtro sigue en pie; solo se queda sin autor.
            $table->foreignId('set_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_ranking_team_filters');
    }
};
