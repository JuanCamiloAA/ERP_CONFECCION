<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employee>
 */
class EmployeeFactory extends Factory
{
    protected $model = Employee::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'document_type' => $this->faker->randomElement(['CC', 'CE', 'TI']),
            'document_number' => $this->faker->unique()->numerify('##########'),
            'phone' => $this->faker->phoneNumber(),
            'email' => $this->faker->unique()->safeEmail(),
            'address' => $this->faker->address(),
            'hire_date' => $this->faker->dateTimeBetween('-3 years', 'now')->format('Y-m-d'),
            'base_salary' => $this->faker->numberBetween(1300000, 3000000),
            'is_active' => true,
            'notes' => null,
        ];
    }

    /**
     * Modalidad hourly_legal: salario mensual (>= SMMLV 2026) usado para el valor/hora legal.
     */
    public function hourlyLegal(): static
    {
        return $this->state(fn () => [
            'payroll_mode' => Employee::PAYROLL_MODE_HOURLY_LEGAL,
            'base_salary' => $this->faker->numberBetween(1800000, 3500000),
            'ordinary_hours_per_day' => 8,
            'is_exempt_from_overtime' => false,
            'scheduled_work_days' => Employee::DEFAULT_SCHEDULED_WORK_DAYS,
            'minutes_per_full_workday' => 480,
        ]);
    }
}
