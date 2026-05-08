<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Employee;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Production>
 */
class ProductionFactory extends Factory
{
    protected $model = Production::class;

    public function definition(): array
    {
        $quantity = $this->faker->numberBetween(10, 200);
        $unitPrice = $this->faker->numberBetween(800, 5000);

        return [
            'company_id' => Company::factory(),
            'employee_id' => Employee::factory(),
            'reference_id' => Reference::factory(),
            'operation_id' => Operation::factory(),
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'total_value' => $quantity * $unitPrice,
            'date' => $this->faker->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            'status' => Production::STATUS_CONFIRMED,
            'shift' => $this->faker->randomElement(['manana', 'tarde', 'noche']),
            'notes' => null,
        ];
    }
}
