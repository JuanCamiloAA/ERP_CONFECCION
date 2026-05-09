<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = User::updateOrCreate(
            ['email' => 'camiloamariles1024@gmail.com'],
            [
                'name' => 'Camilo',
                'last_name' => 'Admin',
                'password' => Hash::make('Irenemom41'),
                'company_id' => null,
                'employee_id' => null,
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $superAdmin->syncRoles(['super_admin']);
    }
}
