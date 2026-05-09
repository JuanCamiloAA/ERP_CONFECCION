<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_globals', function (Blueprint $table) {
            $table->string('plan_inquiry_notify_email')->nullable()->after('navbar_cta_url');
        });
    }

    public function down(): void
    {
        Schema::table('landing_globals', function (Blueprint $table) {
            $table->dropColumn('plan_inquiry_notify_email');
        });
    }
};
