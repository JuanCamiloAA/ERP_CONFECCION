<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * TIMESTAMP en MySQL solo admite hasta 2038-01-19 (limite de epoch de 32 bits).
 * Los planes de membresia pueden fijar vencimientos mas lejanos (ej. "sin vencimiento"
 * practico con una fecha muy futura), por eso se convierte a DATETIME (admite hasta 9999).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `companies` MODIFY `membership_started_at` DATETIME NULL');
        DB::statement('ALTER TABLE `companies` MODIFY `membership_ends_at` DATETIME NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `companies` MODIFY `membership_started_at` TIMESTAMP NULL');
        DB::statement('ALTER TABLE `companies` MODIFY `membership_ends_at` TIMESTAMP NULL');
    }
};
