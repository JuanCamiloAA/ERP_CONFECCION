<?php

namespace Database\Seeders;

use App\Models\Holiday;
use App\Services\HolidayService;
use Illuminate\Database\Seeder;

class HolidaySeeder extends Seeder
{
    public function run(): void
    {
        $service = app(HolidayService::class);

        for ($year = 2023; $year <= 2028; $year++) {
            $service->syncYear($year);
        }

        // Ley 2578 de 2026: festivo puntual fuera del patron habitual (Colombia paso de 18 a 19
        // festivos ese ano). No forma parte del algoritmo determinístico; se deja como ejemplo de
        // festivo manual editable desde Holidays/Index.tsx.
        Holiday::query()->updateOrCreate(
            ['country_code' => 'CO', 'date' => '2026-07-09'],
            ['name' => 'Virgen de Chiquinquirá', 'is_emiliani_shifted' => false, 'source' => Holiday::SOURCE_MANUAL],
        );
    }
}
