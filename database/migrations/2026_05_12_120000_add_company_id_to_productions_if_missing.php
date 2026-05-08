<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('productions', 'company_id')) {
            return;
        }

        Schema::table('productions', function (Blueprint $table) {
            $table->unsignedBigInteger('company_id')->nullable()->after('id');
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(
                'UPDATE productions p INNER JOIN employees e ON e.id = p.employee_id SET p.company_id = e.company_id WHERE p.company_id IS NULL'
            );
            DB::statement(
                'UPDATE productions p INNER JOIN `references` r ON r.id = p.reference_id SET p.company_id = r.company_id WHERE p.company_id IS NULL'
            );
        } else {
            foreach (DB::table('productions')->whereNull('company_id')->cursor() as $row) {
                $companyId = DB::table('employees')->where('id', $row->employee_id)->value('company_id');
                if ($companyId === null) {
                    $companyId = DB::table('references')->where('id', $row->reference_id)->value('company_id');
                }
                if ($companyId !== null) {
                    DB::table('productions')->where('id', $row->id)->update(['company_id' => $companyId]);
                }
            }
        }

        if (DB::table('productions')->whereNull('company_id')->exists()) {
            throw new \RuntimeException(
                'No se pudo rellenar productions.company_id en todas las filas. Revisa empleados/referencias huerfanas.'
            );
        }

        Schema::table('productions', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE productions MODIFY company_id BIGINT UNSIGNED NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('productions', 'company_id')) {
            return;
        }

        Schema::table('productions', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
