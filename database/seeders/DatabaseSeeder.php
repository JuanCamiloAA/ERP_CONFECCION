<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CompanySeeder::class,
            RolesPermissionsSeeder::class,
            UserSeeder::class,
            BankSeeder::class,
            DemoDataSeeder::class,
        ]);
    }
}
