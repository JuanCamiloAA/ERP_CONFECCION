<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_legal_parameters', function (Blueprint $table) {
            $table->id();
            // NULL = parametro global de sistema (default para empresas sin tramo propio)
            $table->foreignId('company_id')->nullable()->constrained('companies')->cascadeOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->decimal('weekly_legal_hours', 5, 2);
            $table->decimal('monthly_hours_divisor', 6, 2);
            $table->time('night_start_time');
            $table->time('night_end_time');
            $table->decimal('night_surcharge_percent', 5, 2);
            $table->decimal('overtime_day_percent', 5, 2);
            $table->decimal('overtime_night_percent', 5, 2);
            $table->decimal('sunday_holiday_surcharge_percent', 5, 2);
            $table->decimal('max_overtime_hours_per_day', 4, 2);
            $table->decimal('max_overtime_hours_per_week', 5, 2);
            $table->boolean('discount_unexcused_absences')->default(false);
            $table->decimal('absence_discount_percent', 5, 2)->default(100.00);
            $table->string('legal_reference')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'effective_from', 'effective_to'], 'payroll_legal_params_company_effective_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_legal_parameters');
    }
};
