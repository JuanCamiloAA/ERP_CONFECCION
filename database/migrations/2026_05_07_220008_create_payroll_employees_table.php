<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_id')->constrained('payrolls')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->decimal('production_total', 14, 2)->default(0);
            $table->json('deductions')->nullable();
            $table->json('additions')->nullable();
            $table->decimal('advances_discount', 14, 2)->default(0);
            $table->decimal('net_payment', 14, 2)->default(0);
            $table->boolean('is_paid')->default(false);
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['payroll_id', 'employee_id']);
            $table->index('is_paid');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_employees');
    }
};
