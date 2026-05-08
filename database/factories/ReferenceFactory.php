<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Reference;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Reference>
 */
class ReferenceFactory extends Factory
{
    protected $model = Reference::class;

    public function definition(): array
    {
        $lot = $this->faker->numberBetween(1000, 50_000);

        return [
            'company_id' => Company::factory(),
            'code' => 'REF-'.$this->faker->unique()->numerify('####'),
            'name' => $this->faker->randomElement(['Camisa Manga Larga', 'Pantalon Jean', 'Falda Cuadrada', 'Vestido Casual', 'Blusa Estampada', 'Chaqueta Deportiva']),
            'description' => $this->faker->sentence(),
            'is_active' => true,
            'lot_total_quantity' => $lot,
            'payment_per_unit' => $this->faker->randomFloat(2, 8_000, 45_000),
            'operational_cost_per_unit_fixed' => $this->faker->randomFloat(2, 2_000, 10_000),
            'operational_lot_qty_at_cost_fix' => $lot,
        ];
    }
}
