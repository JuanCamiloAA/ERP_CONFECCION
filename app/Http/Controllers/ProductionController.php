<?php

namespace App\Http\Controllers;

use App\Http\Requests\Production\StoreProductionRequest;
use App\Http\Requests\Production\UpdateProductionRequest;
use App\Models\Employee;
use App\Models\Operation;
use App\Models\Payroll;
use App\Models\Production;
use App\Models\Reference;
use App\Models\User;
use App\Services\ProductionReportService;
use App\Services\WorkDaySessionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductionController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $filters = [
            'employee_id' => $request->input('employee_id'),
            'reference_id' => $request->input('reference_id'),
            'operation_id' => $request->input('operation_id'),
            'date_start' => $request->input('date_start'),
            'date_end' => $request->input('date_end'),
            'shift' => $request->input('shift'),
        ];

        $query = Production::query()->with([
            'employee:id,first_name,last_name',
            'reference:id,code,name',
            'operation:id,name',
        ]);

        $this->applyEmployeeRestriction($query, $user);

        if ($filters['employee_id']) {
            $query->where('employee_id', $filters['employee_id']);
        }
        if ($filters['reference_id']) {
            $query->where('reference_id', $filters['reference_id']);
        }
        if ($filters['operation_id']) {
            $query->where('operation_id', $filters['operation_id']);
        }
        if ($filters['date_start']) {
            $query->where('date', '>=', $filters['date_start']);
        }
        if ($filters['date_end']) {
            $query->where('date', '<=', $filters['date_end']);
        }
        if ($filters['shift']) {
            $query->where('shift', $filters['shift']);
        }

        /** Mismo filtro que el listado, sin eager/limit/order: evita fromSub + scope (rompe el SQL) y evita clonar tras paginate(). */
        $totalsRow = (clone $query)
            ->withoutEagerLoads()
            ->reorder()
            ->selectRaw('SUM(quantity) as total_quantity, SUM(total_value) as total_value')
            ->first();

        $productions = $query->orderByDesc('date')->orderByDesc('id')->paginate(20)->withQueryString();

        $workerMode = $user->isRestrictedProductionAccount();

        $referencesWithOperations = null;
        if ($workerMode) {
            $referencesWithOperations = $this->referencesForProductionForm();
        }

        $lockedEmployee = null;
        if ($workerMode && $user->employee_id) {
            $user->loadMissing('employee');
            $lockedEmployee = [
                'id' => $user->employee_id,
                'name' => $user->employee?->full_name ?? '',
                'payroll_mode' => $user->employee?->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS,
            ];
        }

        $workDayBanner = null;
        $workDaySelectableEmployees = collect();

        if ($workerMode && $user->employee_id) {
            $emp = Employee::query()->find($user->employee_id);
            if ($emp?->isPayrollFixedDaily()) {
                $svc = app(WorkDaySessionService::class);
                $st = $svc->getTodayState($emp);
                $workDayBanner = array_merge($st, [
                    'mode' => 'self',
                    'employee_id' => $emp->id,
                ]);
            }
        } elseif ($user->can('productions.index.workday_start')) {
            $workDaySelectableEmployees = Employee::query()
                ->active()
                ->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY)
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name']);
        }

        return Inertia::render('Productions/Index', [
            'productions' => $productions,
            'filters' => $filters,
            'totals' => [
                'total_quantity' => (int) ($totalsRow->total_quantity ?? 0),
                'total_value' => (float) ($totalsRow->total_value ?? 0),
            ],
            'employees' => $workerMode ? [] : $this->employeesList(),
            'references' => Reference::active()->orderBy('code')->get(['id', 'code', 'name']),
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name']),
            'workerMode' => $workerMode,
            'lockedEmployee' => $lockedEmployee,
            'referencesWithOperations' => $referencesWithOperations ?? [],
            'workDayBanner' => $workDayBanner,
            'workDaySelectableEmployees' => $workDaySelectableEmployees,
        ]);
    }

    public function create(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->isRestrictedProductionAccount()) {
            return redirect()->route('productions.index');
        }

        $workDaySelectableEmployees = Employee::query()
            ->active()
            ->where('payroll_mode', Employee::PAYROLL_MODE_FIXED_DAILY)
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name']);

        return Inertia::render('Productions/Create', [
            'employees' => $this->employeesList(),
            'references' => $this->referencesForProductionForm(),
            'workDaySelectableEmployees' => $workDaySelectableEmployees,
        ]);
    }

    public function store(StoreProductionRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $unitPrice = $this->resolveUnitPriceForSave($user, $data);

        Production::create([
            'company_id' => $user->company_id,
            'employee_id' => $data['employee_id'],
            'reference_id' => $data['reference_id'],
            'operation_id' => $data['operation_id'],
            'quantity' => $data['quantity'],
            'unit_price' => $unitPrice,
            'date' => $data['date'],
            'status' => $user->isRestrictedProductionAccount() ? Production::STATUS_PENDING : Production::STATUS_CONFIRMED,
            'shift' => $data['shift'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return redirect()->route('productions.index')->with('success', 'Produccion registrada.');
    }

    public function edit(Request $request, Production $production): Response
    {
        return Inertia::render('Productions/Edit', [
            'production' => $production,
            'employees' => $this->employeesList(),
            'references' => $this->referencesForProductionForm($production),
            'priceLocked' => $request->user()?->isRestrictedProductionAccount() ?? false,
            'statusEditable' => ! ($request->user()?->isRestrictedProductionAccount() ?? false),
        ]);
    }

    public function update(UpdateProductionRequest $request, Production $production): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $unitPrice = $this->resolveUnitPriceForUpdate($user, $data, $production);

        $payload = array_merge($data, ['unit_price' => $unitPrice]);
        if ($user->isRestrictedProductionAccount()) {
            unset($payload['status']);
        }
        $production->update($payload);

        return redirect()->route('productions.index')->with('success', 'Produccion actualizada.');
    }

    public function destroy(Production $production): RedirectResponse
    {
        if (Payroll::paidPeriodCoversDate((int) $production->company_id, $production->date)) {
            return redirect()
                ->route('productions.index')
                ->with('error', 'No se puede eliminar produccion de un periodo de nomina ya pagado.');
        }

        $production->delete();

        return redirect()->route('productions.index')->with('success', 'Produccion eliminada.');
    }

    public function report(Request $request, ProductionReportService $service): Response
    {
        $user = $request->user();
        $companyId = $user->company_id ?? session('active_company_id');

        $start = $request->input('start', now()->startOfMonth()->toDateString());
        $end = $request->input('end', now()->endOfMonth()->toDateString());

        return Inertia::render('Productions/Report', [
            'filters' => ['start' => $start, 'end' => $end],
            'summary' => $service->summary($start, $end, $companyId),
            'byEmployee' => $service->byEmployee($start, $end, $companyId),
            'byReference' => $service->byReference($start, $end, $companyId),
            'byOperation' => $service->byOperation($start, $end, $companyId),
            'dailySeries' => $service->dailySeries($start, $end, $companyId),
        ]);
    }

    protected function applyEmployeeRestriction($query, $user): void
    {
        if ($user->isRestrictedProductionAccount()) {
            $query->where('employee_id', $user->employee_id);
        }
    }

    protected function employeesList()
    {
        return Employee::active()->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'document_number']);
    }

    /**
     * Referencias con operaciones activas y total producido (suma de cantidades) para tope de lote.
     * Al editar, incluye la referencia/operacion del registro aunque el lote este cerrado (inactivo).
     */
    protected function referencesForProductionForm(?Production $editing = null)
    {
        $references = Reference::active()
            ->withSum('productions', 'quantity')
            ->with(['operations' => function ($q) {
                $q->wherePivot('is_active', true);
            }])
            ->orderBy('code')
            ->get();

        if ($editing && ! $references->contains(fn ($r) => (int) $r->id === (int) $editing->reference_id)) {
            $extra = Reference::query()
                ->where('id', $editing->reference_id)
                ->withSum('productions', 'quantity')
                ->with(['operations' => function ($q) use ($editing) {
                    $q->where(function ($inner) use ($editing) {
                        $inner->where('reference_operations.is_active', true)
                            ->orWhere('operations.id', $editing->operation_id);
                    });
                }])
                ->first();
            if ($extra) {
                $references->push($extra);
                $references = $references->sortBy('code')->values();
            }
        }

        $this->hydrateProductionQuantitiesByOperation($references);

        return $references;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Reference>  $references
     */
    protected function hydrateProductionQuantitiesByOperation($references): void
    {
        if ($references->isEmpty()) {
            return;
        }

        $refIds = $references->pluck('id');
        $rows = Production::query()
            ->withoutGlobalScopes()
            ->selectRaw('reference_id, operation_id, SUM(quantity) as qty')
            ->whereIn('reference_id', $refIds)
            ->groupBy('reference_id', 'operation_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row->reference_id][(int) $row->operation_id] = (int) $row->qty;
        }

        foreach ($references as $ref) {
            $byOp = $map[(int) $ref->id] ?? [];
            $ref->setAttribute('productions_quantity_by_operation', $byOp === [] ? new \stdClass : $byOp);
        }
    }

    protected function unitPriceFromReferenceOperation(int $referenceId, int $operationId): float
    {
        $reference = Reference::find($referenceId);
        $row = $reference?->operations()->where('operations.id', $operationId)->first();

        return (float) ($row?->pivot?->price ?? Operation::find($operationId)?->base_price ?? 0);
    }

    protected function resolveUnitPriceForSave(?User $user, array $data): float
    {
        if ($user?->isRestrictedProductionAccount()) {
            return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
        }

        $unitPrice = $data['unit_price'] ?? null;
        if ($unitPrice !== null && $unitPrice !== '') {
            return (float) $unitPrice;
        }

        return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
    }

    protected function resolveUnitPriceForUpdate(?User $user, array $data, Production $production): float
    {
        if ($user?->isRestrictedProductionAccount()) {
            return $this->unitPriceFromReferenceOperation((int) $data['reference_id'], (int) $data['operation_id']);
        }

        $unitPrice = $data['unit_price'] ?? null;
        if ($unitPrice !== null && $unitPrice !== '') {
            return (float) $unitPrice;
        }

        return (float) $production->unit_price;
    }
}
