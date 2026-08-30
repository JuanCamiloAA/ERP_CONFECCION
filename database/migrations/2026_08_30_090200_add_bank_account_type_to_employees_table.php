<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tipo de cuenta del empleado (ahorros o corriente).
 *
 * Los archivos de dispersión lo piden y hasta ahora había que deducirlo o anotarlo aparte.
 * Queda nulo para las billeteras digitales, que no tienen tipo de cuenta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('bank_account_type', 20)->nullable()->after('bank_id');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('bank_account_type');
        });
    }
};
