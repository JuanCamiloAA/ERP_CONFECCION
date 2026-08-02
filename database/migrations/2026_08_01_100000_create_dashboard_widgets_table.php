<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dashboard_widgets', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // nombre interno para el super admin
            $table->string('title'); // titulo mostrado a los usuarios finales
            $table->text('description')->nullable();
            $table->enum('type', ['kpi', 'bar', 'line', 'pie', 'table']);
            $table->enum('query_mode', ['builder', 'sql']);
            $table->json('query_definition')->nullable();
            $table->text('raw_sql')->nullable();
            $table->json('chart_config')->nullable();
            $table->unsignedInteger('refresh_interval_seconds')->default(120);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dashboard_widgets');
    }
};
