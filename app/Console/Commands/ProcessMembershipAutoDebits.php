<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\CompanyBillingCharge;
use Illuminate\Console\Command;

/**
 * Cobro automatico de la membresia.
 *
 * El hueco esta hecho, el cobro no: no hay pasarela conectada todavia (ver §0.5 del
 * rediseño de Mi empresa). Hoy el comando solo informa que empresas cobraria, para poder
 * comprobar la seleccion sin mover dinero; con `--dry-run` es lo unico que hace, y sin el
 * tambien, porque el llamado real esta marcado como TODO mas abajo.
 *
 * Cuando exista integracion, el orden importa: primero se crea la fila `pendiente` y luego
 * se llama a la pasarela. Al reves, un cobro que sale bien y una caida justo despues
 * dejarian a la empresa cobrada sin rastro en el historial.
 */
class ProcessMembershipAutoDebits extends Command
{
    protected $signature = 'membership:process-auto-debits {--dry-run : Solo lista lo que cobraria}';

    protected $description = 'Cobra la renovacion de las empresas con debito automatico vencido (pendiente de integrar la pasarela).';

    public function handle(): int
    {
        $companies = Company::query()
            ->with(['membershipPlan', 'paymentMethod'])
            ->where('auto_debit_enabled', true)
            ->whereNotNull('next_charge_at')
            ->whereDate('next_charge_at', '<=', now()->toDateString())
            ->get();

        if ($companies->isEmpty()) {
            $this->info('No hay renovaciones pendientes hoy.');

            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');

        foreach ($companies as $company) {
            $plan = $company->membershipPlan;
            $amount = $plan?->price_monthly;

            // Sin plan, sin precio o sin tarjeta no hay nada que cobrar; se avisa y se sigue
            // con las demas en vez de abortar la corrida entera.
            if ($plan === null || $amount === null || $company->paymentMethod === null) {
                $this->warn("· {$company->name}: sin plan, sin precio o sin tarjeta. Se omite.");

                continue;
            }

            $concept = "Renovacion mensual — Plan {$plan->name}";

            if ($dryRun) {
                $this->line("· {$company->name}: {$concept} por {$amount}.");

                continue;
            }

            $charge = CompanyBillingCharge::create([
                'company_id' => $company->id,
                'membership_plan_id' => $plan->id,
                'amount' => $amount,
                'currency' => (string) (($company->settings['currency'] ?? null) ?: 'COP'),
                'concept' => $concept,
                'status' => CompanyBillingCharge::STATUS_PENDING,
            ]);

            // TODO: conectar pasarela. Aqui va el cobro contra `payment_gateway` usando
            // `payment_customer_id` y el `gateway_token` de la tarjeta; con la respuesta se
            // actualiza `status`, `gateway_reference` y `charged_at`, y solo si sale
            // `pagado` se adelanta `next_charge_at` y `membership_ends_at` un periodo.
            $this->warn("· {$company->name}: cobro #{$charge->id} queda en pendiente (pasarela sin conectar).");
        }

        return self::SUCCESS;
    }
}
