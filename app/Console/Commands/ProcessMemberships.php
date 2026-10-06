<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\Membership\MembershipService;
use Illuminate\Console\Command;

/**
 * Ronda diaria de la membresia: pasa a gracia lo vencido y suspende la gracia que se agoto.
 *
 * Reemplaza a `membership:process-auto-debits`, que se conserva como alias para no romper
 * una tarea programada que lo llame por su nombre viejo. Aquel creaba cada dia un cobro
 * «pendiente» nuevo por empresa con renovacion automatica, porque nunca adelantaba la fecha
 * del proximo cobro; este no crea cobros que no pueda liquidar.
 */
class ProcessMemberships extends Command
{
    protected $signature = 'membership:process {--dry-run : Muestra lo que haria sin cambiar nada}';

    protected $description = 'Pasa a gracia las membresias vencidas y suspende las que agotaron la gracia';

    /** @var list<string> */
    protected $aliases = ['membership:process-auto-debits'];

    public function handle(MembershipService $membership): int
    {
        $dry = (bool) $this->option('dry-run');

        if ($dry) {
            $this->warn('Simulacion: no se cambia nada.');
        }

        // 1. Vencidas sin renovar: a gracia. El acceso dura todo el dia del vencimiento.
        $toGrace = Company::query()
            ->whereIn('membership_status', [Company::MEMBERSHIP_ACTIVE, Company::MEMBERSHIP_TRIAL])
            ->whereNotNull('membership_ends_at')
            ->whereDate('membership_ends_at', '<', today())
            ->get();

        foreach ($toGrace as $company) {
            $this->line("A gracia: {$company->name}");
            $dry || $membership->startGrace($company);
        }

        // 2. Gracia agotada: suspendida.
        $toSuspend = Company::query()
            ->where('membership_status', Company::MEMBERSHIP_GRACE)
            ->whereNotNull('grace_ends_at')
            ->where('grace_ends_at', '<=', now())
            ->get();

        foreach ($toSuspend as $company) {
            $this->line("Suspendida: {$company->name}");
            $dry || $membership->suspend($company);
        }

        // 3. Alguien alargo el vencimiento por fuera de Empresas: vuelve a estar activa.
        $current = Company::query()
            ->whereIn('membership_status', [Company::MEMBERSHIP_GRACE, Company::MEMBERSHIP_SUSPENDED])
            ->where(fn ($query) => $query->whereNull('membership_ends_at')->orWhereDate('membership_ends_at', '>=', today()))
            ->get();

        foreach ($current as $company) {
            $this->line("Reactivada: {$company->name}");
            $dry || $membership->reactivateIfCurrent($company);
        }

        $this->info('Listo.');

        return self::SUCCESS;
    }
}
