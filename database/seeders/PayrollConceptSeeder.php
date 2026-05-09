<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\PayrollConcept;
use Illuminate\Database\Seeder;

class PayrollConceptSeeder extends Seeder
{
    public function run(): void
    {
        $samples = [
            ['name' => 'Bonificacion por puntualidad', 'code' => 'BON_PUNT', 'sort_order' => 10],
            ['name' => 'Auxilio de transporte extra', 'code' => 'AUX_TRANS', 'sort_order' => 20],
            ['name' => 'Prima o reconocimiento', 'code' => 'PRIMA', 'sort_order' => 30],
            ['name' => 'Ajuste manual positivo', 'code' => 'AJUSTE', 'sort_order' => 40],
            ['name' => 'Horas extra no registradas en produccion', 'code' => 'HEXTRA', 'sort_order' => 50],
        ];

        Company::query()->orderBy('id')->each(function (Company $company) use ($samples): void {
            foreach ($samples as $row) {
                PayrollConcept::withoutGlobalScopes()->firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'name' => $row['name'],
                    ],
                    [
                        'code' => $row['code'],
                        'description' => null,
                        'sort_order' => $row['sort_order'],
                        'is_active' => true,
                    ]
                );
            }
        });
    }
}
