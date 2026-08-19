<?php

namespace App\Console\Commands;

use App\Models\Payroll;
use App\Models\Production;
use App\Models\Scopes\CompanyScope;
use App\Services\PayrollCalculationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Normalizacion unica: pone en `pagado` la produccion que ya quedo liquidada en nominas
 * pagadas antes de que existiera ese estado.
 *
 * De aqui en adelante lo hace solo el cierre de la nomina; este comando existe para el
 * historico. Reusa el mismo criterio de seleccion (PayrollCalculationService), asi que
 * cierra exactamente lo que habria cerrado el pago en su momento: solo la produccion de
 * empleados liquidados por operaciones, dentro del periodo de la nomina.
 *
 * Es seguro repetirlo: lo ya cerrado no vuelve a entrar.
 */
class CloseProductionsOfPaidPayrolls extends Command
{
    protected $signature = 'productions:close-paid
        {--company= : Limita la revision a una empresa}
        {--dry-run : Solo informa lo que cambiaria, sin escribir}';

    protected $description = 'Marca como pagada la produccion que ya quedo liquidada en nominas pagadas (normalizacion del historico).';

    public function handle(PayrollCalculationService $calculator): int
    {
        $seco = (bool) $this->option('dry-run');

        $payrolls = Payroll::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('status', Payroll::STATUS_PAID)
            ->when($this->option('company'), fn ($q, $company) => $q->where('company_id', (int) $company))
            ->orderBy('company_id')
            ->orderBy('period_start')
            ->get();

        if ($payrolls->isEmpty()) {
            $this->info('No hay nominas pagadas que revisar.');

            return self::SUCCESS;
        }

        $this->info(($seco ? 'Simulacion sobre ' : 'Revisando ').$payrolls->count().' nomina(s) pagada(s).');
        $this->newLine();

        $filas = [];
        // En simulacion se acumulan ids y no conteos: dos nominas pagadas pueden solaparse
        // en el periodo y la misma produccion contaria dos veces.
        $idsPendientes = collect();
        $totalCerradas = 0;

        foreach ($payrolls as $payroll) {
            $query = $calculator->payableProductionsQuery($payroll);

            if ($query === null) {
                $filas[] = [$payroll->id, $payroll->company_id, $payroll->name, '—', 'sin empleados por operaciones'];

                continue;
            }

            if ($seco) {
                $ids = $query->pluck('id');
                $idsPendientes = $idsPendientes->merge($ids);
                $filas[] = [$payroll->id, $payroll->company_id, $payroll->name, $ids->count(), 'se cerrarian'];

                continue;
            }

            $cerradas = DB::transaction(fn () => $calculator->markPaidProductions($payroll));
            $totalCerradas += $cerradas;
            $filas[] = [$payroll->id, $payroll->company_id, $payroll->name, $cerradas, $cerradas > 0 ? 'cerradas' : 'nada por cerrar'];
        }

        $this->table(['Nomina', 'Empresa', 'Nombre', 'Producciones', ''], $filas);

        if ($seco) {
            $this->warn('Simulacion: no se escribio nada. Producciones distintas que cambiarian: '.$idsPendientes->unique()->count());

            return self::SUCCESS;
        }

        $this->info('Producciones cerradas: '.$totalCerradas);

        $quedanSinCerrar = Production::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereIn('status', Production::PAYABLE_STATUSES)
            ->when($this->option('company'), fn ($q, $company) => $q->where('company_id', (int) $company))
            ->count();

        $this->line('Produccion aun liquidable (pendiente o confirmada): '.$quedanSinCerrar);

        return self::SUCCESS;
    }
}
