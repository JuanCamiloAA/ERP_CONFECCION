<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->foreignId('bank_id')->nullable()->after('minutes_per_full_workday')->constrained()->nullOnDelete();
            $table->string('bank_account_number', 34)->nullable()->after('bank_id');
            $table->string('bank_key', 100)->nullable()->after('bank_account_number');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bank_id');
            $table->dropColumn(['bank_account_number', 'bank_key']);
        });
    }
};
