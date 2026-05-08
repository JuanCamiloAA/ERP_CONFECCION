<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('payroll_mode', 32)->default('operations')->after('base_salary');
            $table->decimal('daily_salary', 12, 2)->nullable()->after('payroll_mode');
            $table->unsignedInteger('minutes_per_full_workday')->default(480)->after('daily_salary');
        });

        DB::table('employees')->update(['payroll_mode' => 'operations']);
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['payroll_mode', 'daily_salary', 'minutes_per_full_workday']);
        });
    }
};
