<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->decimal('daily_work_subtotal', 12, 2)->default(0)->after('production_total');
            $table->json('validated_work_days')->nullable()->after('daily_work_subtotal');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->dropColumn(['daily_work_subtotal', 'validated_work_days']);
        });
    }
};
