<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Operation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Operation>
 */
class OperationFactory extends Factory
{
    protected $model = Operation::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => $this->faker->randomElement(['Cortado', 'Cosido', 'Ojalado', 'Botonado', 'Planchado', 'Empacado', 'Marcacion', 'Bordado']),
            'description' => $this->faker->sentence(),
            'base_price' => $this->faker->numberBetween(500, 5000),
            'is_active' => true,
        ];
    }
}
