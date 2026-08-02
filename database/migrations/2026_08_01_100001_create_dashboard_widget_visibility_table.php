<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dashboard_widget_visibility', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dashboard_widget_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained('roles')->cascadeOnDelete(); // null = todos los roles de esa empresa
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['dashboard_widget_id', 'company_id', 'role_id'], 'dwv_widget_company_role_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dashboard_widget_visibility');
    }
};
