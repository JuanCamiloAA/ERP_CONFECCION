<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\PayrollConcept;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PayrollConcept>
 */
class PayrollConceptFactory extends Factory
{
    protected $model = PayrollConcept::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => fake()->unique()->words(3, true),
            'code' => fake()->optional()->lexify('???'),
            'description' => fake()->optional()->sentence(),
            'sort_order' => fake()->numberBetween(0, 100),
            'is_active' => true,
        ];
    }
}
