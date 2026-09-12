<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Production;
use App\Notifications\WeeklyProductionDigestNotification;
use App\Services\Account\AccountNotifier;
use App\Support\NotificationPreferences;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Resumen semanal de produccion por empresa.
 *
 * Corre los lunes y mira la semana natural anterior (lunes a domingo). Se salta las
 * empresas sin produccion en el periodo: un correo que solo dice «cero» todas las semanas
 * acaba en la carpeta de spam y se lleva por delante los que si importan.
 *
 * Las consultas van sin scope de empresa porque no hay sesion en un comando de consola; el
 * filtro por `company_id` es explicito en cada una.
 */
class SendWeeklyProductionDigest extends Command
{
    protected $signature = 'notifications:weekly-production-digest
                            {--company= : Limitar a una empresa}
                            {--dry-run : Calcular y mostrar sin enviar}';

    protected $description = 'Envia el resumen semanal de produccion a quien lo tenga activado.';

    public function handle(AccountNotifier $notifier): int
    {
        $to = Carbon::today()->startOfWeek()->subDay()->endOfDay();      // domingo pasado
        $from = $to->copy()->startOfWeek()->startOfDay();                 // lunes pasado

        $this->info('Semana: '.$from->toDateString().' a '.$to->toDateString());

        $companies = Company::query()
            ->where('is_active', true)
            ->when($this->option('company'), fn ($q, $id) => $q->whereKey((int) $id))
            ->orderBy('id')
            ->get(['id', 'name']);

        $totalSent = 0;

        foreach ($companies as $company) {
            $summary = $this->summarize((int) $company->id, $from, $to);

            if ($summary['units'] === 0) {
                $this->line("  {$company->name}: sin produccion, se omite.");

                continue;
            }

            $recipients = $notifier->companyRecipients((int) $company->id, [
                'productions.index.view',
                'productions.report.view',
            ]);

            if ($this->option('dry-run')) {
                $wanting = $recipients->filter(
                    fn ($user) => $user->wantsNotification(NotificationPreferences::WEEKLY_PRODUCTION_DIGEST)
                )->count();
                $this->line("  {$company->name}: {$summary['units']} und · {$wanting} destinatario(s) [dry-run]");

                continue;
            }

            $sent = $notifier->deliver(
                $recipients,
                NotificationPreferences::WEEKLY_PRODUCTION_DIGEST,
                fn () => new WeeklyProductionDigestNotification(
                    $from,
                    $to,
                    $summary['units'],
                    $summary['value'],
                    $summary['employees'],
                    $summary['top'],
                ),
            );

            $totalSent += $sent;
            $this->line("  {$company->name}: {$summary['units']} und · {$sent} correo(s)");
        }

        $this->info("Enviados: {$totalSent}");

        return self::SUCCESS;
    }

    /**
     * @return array{units: int, value: float, employees: int, top: list<array{name: string, quantity: int, value: float}>}
     */
    protected function summarize(int $companyId, Carbon $from, Carbon $to): array
    {
        $base = fn () => Production::query()
            ->withoutGlobalScopes()
            ->whereNull('productions.deleted_at')
            ->where('productions.company_id', $companyId)
            ->whereBetween('productions.date', [$from->toDateString(), $to->toDateString()]);

        $totals = $base()
            ->selectRaw('COALESCE(SUM(quantity),0) as units, COALESCE(SUM(total_value),0) as value, COUNT(DISTINCT employee_id) as employees')
            ->first();

        $top = $base()
            ->join('employees', 'employees.id', '=', 'productions.employee_id')
            ->selectRaw("CONCAT(employees.first_name,' ',employees.last_name) as name, SUM(productions.quantity) as quantity, SUM(productions.total_value) as value")
            ->groupBy('employees.id', 'employees.first_name', 'employees.last_name')
            ->orderByDesc('quantity')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => trim((string) $row->name),
                'quantity' => (int) $row->quantity,
                'value' => (float) $row->value,
            ])
            ->values()
            ->all();

        return [
            'units' => (int) ($totals->units ?? 0),
            'value' => (float) ($totals->value ?? 0),
            'employees' => (int) ($totals->employees ?? 0),
            'top' => $top,
        ];
    }
}
