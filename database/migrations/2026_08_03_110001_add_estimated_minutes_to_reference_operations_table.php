<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reference_operations', function (Blueprint $table) {
            // Null = hereda los minutos (y por tanto la dificultad) del dato maestro de la operacion.
            $table->decimal('estimated_minutes', 8, 2)->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('reference_operations', function (Blueprint $table) {
            $table->dropColumn('estimated_minutes');
        });
    }
};
