<?php

namespace Database\Seeders;

use App\Models\Bank;
use App\Models\Company;
use Illuminate\Database\Seeder;

class BankSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            return;
        }

        $names = [
            ['code' => 'BCO', 'name' => 'Bancolombia'],
            ['code' => 'BBO', 'name' => 'Banco de Bogota'],
            ['code' => 'BBV', 'name' => 'Banco BBVA Colombia'],
            ['code' => 'DAV', 'name' => 'Banco Davivienda'],
            ['code' => 'OCC', 'name' => 'Banco de Occidente'],
            ['code' => 'POP', 'name' => 'Banco Popular'],
            ['code' => 'AGR', 'name' => 'Banco Agrario de Colombia'],
            ['code' => 'AVV', 'name' => 'Banco AV Villas'],
            ['code' => 'FCB', 'name' => 'Banco Falabella'],
            ['code' => 'CFC', 'name' => 'Banco Caja Social BCSC'],
            ['code' => 'NEQ', 'name' => 'Nequi'],
            ['code' => 'DVP', 'name' => 'Daviplata'],
            ['code' => 'COL', 'name' => 'Scotiabank Colpatria'],
            ['code' => 'PSE', 'name' => 'PSE / Otros (referencia)'],
        ];

        foreach ($names as $row) {
            Bank::withoutGlobalScopes()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $row['name']],
                [
                    'code' => $row['code'],
                    'is_active' => true,
                ]
            );
        }
    }
}
