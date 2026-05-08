<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `payrolls` MODIFY `type` VARCHAR(50) NOT NULL DEFAULT \'quincenal\'');
        } elseif ($driver === 'sqlite') {
            // SQLite: sin cambio destructivo; ya seria string si la tabla es nueva
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `payrolls` MODIFY `type` ENUM('quincenal', 'mensual') NOT NULL DEFAULT 'quincenal'");
        }
    }
};
