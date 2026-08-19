<?php

namespace App\Services;

use App\Models\Production;
use App\Models\Scopes\CompanyScope;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ProductionReportService
{
    public function byEmployee(string $start, string $end, ?int $companyId = null, ?int $employeeId = null, bool $onlyConfirmed = false): Collection
    {
        return $this->baseQuery($start, $end, $companyId, $employeeId, $onlyConfirmed)
            ->selectRaw('employee_id, SUM(quantity) as total_quantity, SUM(total_value) as total_value, COUNT(*) as records')
            ->groupBy('employee_id')
            ->with('employee:id,first_name,last_name,document_number')
            ->orderByDesc('total_value')
            ->get();
    }

    public function byReference(string $start, string $end, ?int $companyId = null, ?int $employeeId = null, bool $onlyConfirmed = false): Collection
    {
        return $this->baseQuery($start, $end, $companyId, $employeeId, $onlyConfirmed)
            ->selectRaw('reference_id, SUM(quantity) as total_quantity, SUM(total_value) as total_value')
            ->groupBy('reference_id')
            ->with('reference:id,code,name')
            ->orderByDesc('total_value')
            ->get();
    }

    public function byOperation(string $start, string $end, ?int $companyId = null, ?int $employeeId = null, bool $onlyConfirmed = false): Collection
    {
        return $this->baseQuery($start, $end, $companyId, $employeeId, $onlyConfirmed)
            ->selectRaw('operation_id, SUM(quantity) as total_quantity, SUM(total_value) as total_value')
            ->groupBy('operation_id')
            ->with('operation:id,name')
            ->orderByDesc('total_value')
            ->get();
    }

    /**
     * Ranking de empleados por unidades producidas, ponderadas por el grado de dificultad de cada
     * operacion (el de la referencia si esta definido, si no el del dato maestro de la operacion).
     */
    public function rankingByEmployee(string $start, string $end, ?int $companyId = null, bool $onlyConfirmed = false): Collection
    {
        $query = Production::query();

        if ($companyId) {
            $query->withoutGlobalScope(CompanyScope::class)->where('productions.company_id', $companyId);
        }

        $query->whereBetween('productions.date', [$start, $end]);

        // Lo ya pagado sigue siendo produccion confirmada: dejarlo fuera vaciaria los
        // reportes de todo periodo cuya nomina ya se cerro.
        if ($onlyConfirmed) {
            $query->whereIn('productions.status', Production::COUNTED_STATUSES);
        }

        return $query
            ->join('operations', 'operations.id', '=', 'productions.operation_id')
            ->leftJoin('reference_operations', function ($join) {
                $join->on('reference_operations.reference_id', '=', 'productions.reference_id')
                    ->on('reference_operations.operation_id', '=', 'productions.operation_id');
            })
            ->selectRaw(
                'productions.employee_id as employee_id, '.
                'SUM(productions.quantity) as total_quantity, '.
                'SUM(productions.total_value) as total_value, '.
                'SUM(productions.quantity * COALESCE(reference_operations.difficulty_level, operations.difficulty_level, 1)) as total_points, '.
                'COUNT(*) as records'
            )
            ->groupBy('productions.employee_id')
            ->with('employee:id,first_name,last_name,document_number,photo')
            ->orderByDesc('total_points')
            ->get();
    }

    public function summary(string $start, string $end, ?int $companyId = null, ?int $employeeId = null, bool $onlyConfirmed = false): array
    {
        $row = $this->baseQuery($start, $end, $companyId, $employeeId, $onlyConfirmed)
            ->selectRaw('SUM(quantity) as total_quantity, SUM(total_value) as total_value, COUNT(*) as total_records, COUNT(DISTINCT employee_id) as total_employees')
            ->first();

        return [
            'total_quantity' => (int) ($row->total_quantity ?? 0),
            'total_value' => (float) ($row->total_value ?? 0),
            'total_records' => (int) ($row->total_records ?? 0),
            'total_employees' => (int) ($row->total_employees ?? 0),
        ];
    }

    public function dailySeries(string $start, string $end, ?int $companyId = null, ?int $employeeId = null, bool $onlyConfirmed = false): array
    {
        $rows = $this->baseQuery($start, $end, $companyId, $employeeId, $onlyConfirmed)
            ->selectRaw('date, SUM(quantity) as total_quantity, SUM(total_value) as total_value')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $byDate = $rows->keyBy(fn ($r) => Carbon::parse($r->date)->toDateString());

        $cursor = Carbon::parse($start);
        $endDate = Carbon::parse($end);
        $series = [];

        while ($cursor->lte($endDate)) {
            $key = $cursor->toDateString();
            $row = $byDate->get($key);
            $series[] = [
                'date' => $key,
                'label' => $cursor->format('d/m'),
                'total_quantity' => (int) ($row->total_quantity ?? 0),
                'total_value' => (float) ($row->total_value ?? 0),
            ];
            $cursor->addDay();
        }

        return $series;
    }

    protected function baseQuery(string $start, string $end, ?int $companyId, ?int $employeeId = null, bool $onlyConfirmed = false)
    {
        $query = Production::query();
        if ($companyId) {
            $query->withoutGlobalScope(CompanyScope::class)->where('company_id', $companyId);
        }

        $query->whereBetween('date', [$start, $end]);

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        if ($onlyConfirmed) {
            $query->whereIn('status', Production::COUNTED_STATUSES);
        }

        return $query;
    }
}
