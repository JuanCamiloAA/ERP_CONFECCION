<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->decimal('adjustments_subtotal', 12, 2)->default(0)->after('validated_work_days');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->dropColumn('adjustments_subtotal');
        });
    }
};
