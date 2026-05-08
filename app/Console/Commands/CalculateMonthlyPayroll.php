<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Payroll;
use App\Services\PayrollCalculationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class CalculateMonthlyPayroll extends Command
{
    protected $signature = 'payroll:calculate-monthly {--company=}';

    protected $description = 'Genera y calcula la nomina del mes anterior para todas las empresas activas.';

    public function handle(PayrollCalculationService $service): int
    {
        $start = Carbon::now()->subMonthNoOverflow()->startOfMonth();
        $end = Carbon::now()->subMonthNoOverflow()->endOfMonth();

        $query = Company::query()->where('is_active', true);
        if ($id = $this->option('company')) {
            $query->where('id', $id);
        }

        $companies = $query->get();

        foreach ($companies as $company) {
            $name = "Nomina mensual {$start->format('M Y')}";

            $exists = Payroll::query()
                ->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->where('type', Payroll::TYPE_MENSUAL)
                ->where('period_start', $start->toDateString())
                ->where('period_end', $end->toDateString())
                ->first();

            if ($exists) {
                $this->warn("Ya existe nomina para {$company->name} ({$name}). Saltando.");
                continue;
            }

            $payroll = Payroll::create([
                'company_id' => $company->id,
                'name' => $name,
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'type' => Payroll::TYPE_MENSUAL,
                'status' => Payroll::STATUS_DRAFT,
                'total_amount' => 0,
            ]);

            $service->calculate($payroll);

            $this->info("Calculada nomina para {$company->name} - Total: {$payroll->fresh()->total_amount}");
        }

        return self::SUCCESS;
    }
}
