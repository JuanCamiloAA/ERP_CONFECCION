<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = User::firstOrCreate(
            ['email' => 'Camiloamariles1024@gmail.com'],
            [
                'name' => 'super',
                'last_name' => 'Admin',
                'password' => Hash::make('Irenemom41'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
        $superAdmin->syncRoles(['super_admin']);

        $company = Company::first();

        if ($company) {
            $admin = User::firstOrCreate(
                ['email' => 'atehortua98fer@gmail.com'],
                [
                    'name' => 'Ferney Esteban',
                    'last_name' => 'Atehortua Amariles',
                    'password' => Hash::make('1037525143'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                    'company_id' => $company->id,
                    'phone' => '+57 304 532 9328',
                ]
            );

            $adminRole = \App\Models\Role::where('name', 'admin')
                ->where('company_id', $company->id)
                ->first();

            if ($adminRole) {
                $admin->syncRoles([$adminRole]);
            }
        }
    }
}
