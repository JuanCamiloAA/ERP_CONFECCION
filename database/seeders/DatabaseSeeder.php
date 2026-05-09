<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Producción: permisos + rol super_admin + un único usuario administrador global.
 * No crea empresa, bancos ni datos demo (use CompanySeeder, BankSeeder, DemoDataSeeder solo en entornos de desarrollo si los necesita).
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesPermissionsSeeder::class,
            UserSeeder::class,
            LandingSeeder::class,
        ]);
    }
}
