<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->foreignId('membership_plan_id')->nullable()->after('settings')->constrained('membership_plans')->nullOnDelete();
            $table->timestamp('membership_started_at')->nullable()->after('membership_plan_id');
            $table->timestamp('membership_ends_at')->nullable()->after('membership_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropForeign(['membership_plan_id']);
            $table->dropColumn(['membership_plan_id', 'membership_started_at', 'membership_ends_at']);
        });
    }
};
