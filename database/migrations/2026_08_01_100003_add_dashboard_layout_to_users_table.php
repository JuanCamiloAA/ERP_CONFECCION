<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Preferencia personal de orden de tarjetas del Dashboard (KPIs fijos + widgets
 * personalizados tipo KPI). Es por usuario, no por empresa ni rol: cada persona
 * puede acomodar su propio dashboard sin afectar a nadie mas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('dashboard_layout')->nullable()->after('password_change_required');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('dashboard_layout');
        });
    }
};
