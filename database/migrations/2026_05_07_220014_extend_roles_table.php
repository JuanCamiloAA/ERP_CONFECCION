<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->foreignId('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('display_name')->after('name');
            $table->text('description')->nullable()->after('display_name');
            $table->string('color', 20)->default('#6366f1')->after('description');
            $table->boolean('is_system')->default(false)->after('color');
        });

        $tableNames = config('permission.table_names');

        $rolesTable = $tableNames['roles'];

        try {
            DB::statement("ALTER TABLE `{$rolesTable}` DROP INDEX `roles_name_guard_name_unique`");
        } catch (\Throwable $e) {
            // Index may not exist if teams mode was enabled.
        }

        Schema::table($rolesTable, function (Blueprint $table) {
            $table->unique(['name', 'guard_name', 'company_id'], 'roles_name_guard_company_unique');
        });
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        $rolesTable = $tableNames['roles'];

        try {
            DB::statement("ALTER TABLE `{$rolesTable}` DROP INDEX `roles_name_guard_company_unique`");
        } catch (\Throwable $e) {
            //
        }

        Schema::table('roles', function (Blueprint $table) {
            $table->unique(['name', 'guard_name']);
            $table->dropForeign(['company_id']);
            $table->dropColumn(['company_id', 'display_name', 'description', 'color', 'is_system']);
        });
    }
};
