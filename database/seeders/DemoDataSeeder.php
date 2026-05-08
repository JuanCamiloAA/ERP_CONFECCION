<?php

namespace Database\Seeders;

use App\Models\Advance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use App\Models\ReferenceOperation;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkDaySession;
use Carbon\CarbonPeriod;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            return;
        }

        $references = $this->seedReferences($company);
        $operations = $this->seedOperations($company);
        $this->seedReferenceOperations($references, $operations);
        $this->syncReferenceOperationalFixedCosts($references);
        $employees = $this->seedEmployees($company);
        $this->markSampleFixedDailyEmployees($company);
        $this->seedEmployeeUsers($company, $employees);
        $this->seedProductions($company, $employees, $references, $operations);
        $this->seedWorkDaySessions($company);
        $this->seedAdvances($company, $employees);
    }

    /** @return \Illuminate\Support\Collection<int, Reference> */
    protected function seedReferences(Company $company): \Illuminate\Support\Collection
    {
        $list = [
            ['code' => 'CAM-001', 'name' => 'Camisa Manga Larga', 'description' => 'Camisa formal manga larga, varios colores', 'lot_total_quantity' => 500_000, 'payment_per_unit' => 28_000],
            ['code' => 'PAN-002', 'name' => 'Pantalon Jean Slim', 'description' => 'Pantalon jean ajustado, tela 100% algodon', 'lot_total_quantity' => 500_000, 'payment_per_unit' => 35_000],
            ['code' => 'BLU-003', 'name' => 'Blusa Estampada', 'description' => 'Blusa estampada, dama, tallas S a XL', 'lot_total_quantity' => 500_000, 'payment_per_unit' => 22_000],
            ['code' => 'CHA-004', 'name' => 'Chaqueta Deportiva', 'description' => 'Chaqueta deportiva con cierre frontal', 'lot_total_quantity' => 500_000, 'payment_per_unit' => 42_000],
            ['code' => 'VES-005', 'name' => 'Vestido Casual', 'description' => 'Vestido casual hasta la rodilla', 'lot_total_quantity' => 500_000, 'payment_per_unit' => 32_000],
        ];

        $created = collect();
        foreach ($list as $row) {
            $created->push(Reference::withoutGlobalScopes()->updateOrCreate(
                ['company_id' => $company->id, 'code' => $row['code']],
                [
                    'company_id' => $company->id,
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'is_active' => true,
                    'lot_total_quantity' => $row['lot_total_quantity'],
                    'payment_per_unit' => $row['payment_per_unit'] ?? null,
                ]
            ));
        }

        return $created;
    }

    /** @return \Illuminate\Support\Collection<int, Operation> */
    protected function seedOperations(Company $company): \Illuminate\Support\Collection
    {
        $list = [
            ['name' => 'Cortado', 'base_price' => 800],
            ['name' => 'Cosido', 'base_price' => 1500],
            ['name' => 'Ojalado', 'base_price' => 600],
            ['name' => 'Botonado', 'base_price' => 700],
            ['name' => 'Planchado', 'base_price' => 500],
            ['name' => 'Empacado', 'base_price' => 400],
            ['name' => 'Bordado', 'base_price' => 1800],
            ['name' => 'Marcacion', 'base_price' => 350],
        ];

        $created = collect();
        foreach ($list as $row) {
            $created->push(Operation::withoutGlobalScopes()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $row['name']],
                array_merge($row, ['company_id' => $company->id, 'is_active' => true])
            ));
        }

        return $created;
    }

    protected function seedReferenceOperations($references, $operations): void
    {
        foreach ($references as $reference) {
            foreach ($operations->random(rand(4, 6)) as $operation) {
                ReferenceOperation::updateOrCreate(
                    ['reference_id' => $reference->id, 'operation_id' => $operation->id],
                    [
                        'price' => $operation->base_price + rand(-100, 200),
                        'is_active' => true,
                    ]
                );
            }
        }
    }

    /** @param  \Illuminate\Support\Collection<int, Reference>  $references */
    protected function syncReferenceOperationalFixedCosts(\Illuminate\Support\Collection $references): void
    {
        foreach ($references as $reference) {
            $sum = (float) ReferenceOperation::where('reference_id', $reference->id)->sum('price');
            Reference::withoutGlobalScopes()->where('id', $reference->id)->update([
                'operational_cost_per_unit_fixed' => round($sum, 2),
                'operational_lot_qty_at_cost_fix' => $reference->lot_total_quantity,
            ]);
        }
    }

    /** @return \Illuminate\Support\Collection<int, Employee> */
    protected function seedEmployees(Company $company): \Illuminate\Support\Collection
    {
        $employees = [
            ['first_name' => 'Leidy', 'last_name' => 'Vasquez', 'doc' => '1020304050'],
            ['first_name' => 'Mateo', 'last_name' => 'Alvarez', 'doc' => '1020304051'],
        ];

        $created = collect();

        foreach ($employees as $i => $row) {
            $employee = Employee::withoutGlobalScopes()->updateOrCreate(
                ['company_id' => $company->id, 'document_number' => $row['doc']],
                [
                    'company_id' => $company->id,
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'document_type' => 'CC',
                    'phone' => '+57 300 555 '.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                    'email' => strtolower($row['first_name']).'.'.strtolower(explode(' ', $row['last_name'])[0]).'@gmail.com',
                    'address' => 'Cra '.rand(1, 80).' # '.rand(1, 200).'-'.rand(1, 99),
                    'hire_date' => now()->subDays(rand(60, 1200))->format('Y-m-d'),
                    'base_salary' => rand(1300000, 2500000),
                    'is_active' => true,
                ]
            );
            $created->push($employee);
        }

        return $created;
    }

    protected function markSampleFixedDailyEmployees(Company $company): void
    {
        foreach (['1020304050'] as $doc) {
            Employee::withoutGlobalScopes()->where('company_id', $company->id)->where('document_number', $doc)->update([
                'payroll_mode' => Employee::PAYROLL_MODE_FIXED_DAILY,
                'daily_salary' => 55_000,
                'minutes_per_full_workday' => 480,
            ]);
        }
    }

    protected function seedEmployeeUsers(Company $company, $employees): void
    {
        $operatorRole = Role::where('name', 'operario_produccion')->where('company_id', $company->id)->first();
        $supervisorRole = Role::where('name', 'supervisor_produccion')->where('company_id', $company->id)->first();

        foreach ($employees as $i => $employee) {
            if ($i === 9) {
                continue;
            }

            $user = User::firstOrCreate(
                ['email' => $employee->email],
                [
                    'name' => $employee->first_name,
                    'last_name' => $employee->last_name,
                    'password' => Hash::make('1234'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                    'company_id' => $company->id,
                    'employee_id' => $employee->id,
                    'phone' => $employee->phone,
                ]
            );

            $employee->forceFill(['user_id' => $user->id])->save();

            $role = ($i < 7) ? $operatorRole : $supervisorRole;
            if ($role) {
                $user->syncRoles([$role]);
            }
        }
    }

    protected function seedProductions(Company $company, $employees, $references, $operations): void
    {
        $fixedDailyIds = Employee::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY)
            ->pluck('id')
            ->all();

        $start = now()->startOfMonth();
        $end = now();
        $period = CarbonPeriod::create($start, $end);

        foreach ($period as $day) {
            if ($day->isWeekend()) {
                continue;
            }
            foreach ($employees as $employee) {
                if (in_array((int) $employee->id, array_map('intval', $fixedDailyIds), true)) {
                    continue;
                }
                $records = rand(1, 3);
                for ($i = 0; $i < $records; $i++) {
                    $reference = $references->random();
                    $refOps = ReferenceOperation::where('reference_id', $reference->id)->get();

                    if ($refOps->isEmpty()) {
                        continue;
                    }

                    $refOp = $refOps->random();
                    $operation = $operations->firstWhere('id', $refOp->operation_id);
                    if (! $operation) {
                        continue;
                    }

                    $quantity = rand(20, 150);
                    Production::withoutGlobalScopes()->create([
                        'company_id' => $company->id,
                        'employee_id' => $employee->id,
                        'reference_id' => $reference->id,
                        'operation_id' => $operation->id,
                        'quantity' => $quantity,
                        'unit_price' => $refOp->price,
                        'total_value' => $quantity * (float) $refOp->price,
                        'date' => $day->format('Y-m-d'),
                        'shift' => collect(['manana', 'tarde', 'noche'])->random(),
                    ]);
                }
            }
        }
    }

    protected function seedWorkDaySessions(Company $company): void
    {
        $employees = Employee::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY)
            ->get();

        if ($employees->isEmpty()) {
            return;
        }

        $start = now()->startOfMonth();
        $end = now();
        $period = CarbonPeriod::create($start, $end);

        foreach ($period as $day) {
            if ($day->isWeekend()) {
                continue;
            }

            foreach ($employees as $employee) {
                $in = $day->copy()->setTime(7, 30, 0);
                $out = $day->copy()->setTime(16, 30, 0);
                $minutes = (int) round($in->diffInMinutes($out));

                WorkDaySession::withoutGlobalScopes()->updateOrCreate(
                    [
                        'company_id' => $company->id,
                        'employee_id' => $employee->id,
                        'work_date' => $day->format('Y-m-d'),
                    ],
                    [
                        'clock_in_at' => $in,
                        'clock_out_at' => $out,
                        'duration_minutes' => $minutes,
                        'status' => WorkDaySession::STATUS_CLOSED,
                        'source' => WorkDaySession::SOURCE_EMPLOYEE,
                    ]
                );
            }
        }
    }

    protected function seedAdvances(Company $company, $employees): void
    {
        foreach ($employees->take(5) as $employee) {
            Advance::withoutGlobalScopes()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'amount' => rand(100000, 500000),
                'date' => now()->subDays(rand(1, 20))->format('Y-m-d'),
                'reason' => collect(['Adelanto quincena', 'Imprevisto familiar', 'Servicios publicos', 'Salud'])->random(),
                'status' => Advance::STATUS_PENDING,
            ]);
        }
    }
}
