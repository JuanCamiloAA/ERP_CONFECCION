<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('landing_globals')) {
            return;
        }

        if (Schema::hasColumn('landing_globals', 'plan_inquiry_notify_email')) {
            return;
        }

        Schema::table('landing_globals', function (Blueprint $table) {
            $table->string('plan_inquiry_notify_email')->nullable()->after('navbar_cta_url');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('landing_globals')) {
            return;
        }

        if (! Schema::hasColumn('landing_globals', 'plan_inquiry_notify_email')) {
            return;
        }

        Schema::table('landing_globals', function (Blueprint $table) {
            $table->dropColumn('plan_inquiry_notify_email');
        });
    }
};
