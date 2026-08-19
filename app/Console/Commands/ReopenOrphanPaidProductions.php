<?php

namespace App\Console\Commands;

use App\Models\Production;
use App\Services\PayrollCalculationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Contrario de productions:close-paid.
 *
 * Reabre la produccion que quedo en `pagado` sin que ninguna nomina pagada la respalde: el
 * caso tipico es haber eliminado una nomina que se cerro antes de que el sistema guardara el
 * estado previo, de modo que no habia con que reponerla. En ese limbo el registro no aparece
 * como pendiente de pago ni entra en una nomina nueva.
 *
 * Es seguro repetirlo: lo que si tiene una nomina pagada detras no se toca.
 */
class ReopenOrphanPaidProductions extends Command
{
    protected $signature = 'productions:reopen-unpaid
        {--company= : Limita la revision a una empresa}
        {--status=confirmado : Estado al que se devuelve (confirmado o pendiente)}
        {--from= : Solo produccion desde esta fecha (YYYY-MM-DD)}
        {--to= : Solo produccion hasta esta fecha (YYYY-MM-DD)}
        {--dry-run : Solo informa lo que cambiaria, sin escribir}';

    protected $description = 'Devuelve a confirmada la produccion marcada como pagada que ya no tiene ninguna nomina pagada detras.';

    public function handle(PayrollCalculationService $calculator): int
    {
        $status = (string) $this->option('status');

        if (! in_array($status, Production::EDITABLE_STATUSES, true)) {
            $this->error('El estado debe ser uno de: '.implode(', ', Production::EDITABLE_STATUSES).'.');

            return self::FAILURE;
        }

        $seco = (bool) $this->option('dry-run');
        $company = $this->option('company') ? (int) $this->option('company') : null;

        $query = $calculator->orphanPaidProductionsQuery(
            $company,
            $this->option('from') ? (string) $this->option('from') : null,
            $this->option('to') ? (string) $this->option('to') : null,
        );

        $filas = (clone $query)
            ->with(['employee:id,first_name,last_name'])
            ->orderBy('productions.date')
            ->get();

        if ($filas->isEmpty()) {
            $this->info('No hay produccion cerrada sin nomina que la respalde. Nada que hacer.');

            return self::SUCCESS;
        }

        $this->table(
            ['Produccion', 'Empresa', 'Fecha', 'Empleado', 'Valor'],
            $filas->map(fn (Production $p) => [
                $p->id,
                $p->company_id,
                $p->date?->toDateString(),
                trim(($p->employee->first_name ?? '').' '.($p->employee->last_name ?? '')) ?: '—',
                number_format((float) $p->total_value),
            ])->all(),
        );

        $total = number_format((float) $filas->sum('total_value'));

        if ($seco) {
            $this->warn("Simulacion: no se escribio nada. Se reabririan {$filas->count()} registro(s) por {$total} como «{$status}».");

            return self::SUCCESS;
        }

        $cambiadas = DB::transaction(fn () => $query->update(['status' => $status]));

        $this->info("Reabiertas {$cambiadas} produccion(es) por {$total} como «{$status}».");
        $this->line('Ya vuelven a contar como pendientes de pago y entraran en la proxima nomina del periodo.');

        return self::SUCCESS;
    }
}
