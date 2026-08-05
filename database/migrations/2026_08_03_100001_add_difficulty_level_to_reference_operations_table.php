<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reference_operations', function (Blueprint $table) {
            // Null = hereda el grado de dificultad del dato maestro de la operacion.
            $table->unsignedTinyInteger('difficulty_level')->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('reference_operations', function (Blueprint $table) {
            $table->dropColumn('difficulty_level');
        });
    }
};
