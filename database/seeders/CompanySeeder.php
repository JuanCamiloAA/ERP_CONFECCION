<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    public function run(): void
    {
        Company::firstOrCreate(
            ['nit' => '1037525143-7'],
            [
                'name' => 'FerTex S.A.S.',
                'address' => 'Carrera 38 # 96-37, Medellin',
                'phone' => '+57 304 532 9328',
                'email' => 'atehortua98fer@gmail.com',
                'is_active' => true,
                'settings' => [
                    'currency' => 'COP',
                    'payroll_periodicity' => 'quincenal',
                    'default_deductions' => [
                        ['key' => 'salud', 'label' => 'Salud', 'percent' => 4],
                        ['key' => 'pension', 'label' => 'Pension', 'percent' => 4],
                    ],
                ],
            ]
        );
    }
}
