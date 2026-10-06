<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que la landing necesita para presentar un plan: una frase que diga para quien es y
 * cual se destaca. Ninguno cambia como se cobra; son solo de presentacion.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('membership_plans', function (Blueprint $table) {
            $table->string('description', 200)->nullable()->after('name');
            $table->boolean('is_featured')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('membership_plans', function (Blueprint $table) {
            $table->dropColumn(['description', 'is_featured']);
        });
    }
};
