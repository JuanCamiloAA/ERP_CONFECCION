<?php

namespace App\Http\Controllers;

use App\Http\Requests\Operation\BulkOperationStatusRequest;
use App\Http\Requests\Operation\StoreOperationRequest;
use App\Http\Requests\Operation\UpdateOperationPriceRequest;
use App\Http\Requests\Operation\UpdateOperationRequest;
use App\Models\Company;
use App\Models\Operation;
use App\Models\Production;
use App\Support\OperationDifficulty;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OperationController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('status', 'all');
        $difficulty = (string) $request->input('difficulty', '');

        $query = Operation::query()->withCount('references')->withCount('productions');

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        } else {
            $status = 'all';
        }

        if ($difficulty !== '' && in_array((int) $difficulty, [1, 2, 3, 4, 5], true)) {
            $query->where('difficulty_level', (int) $difficulty);
        } else {
            $difficulty = '';
        }

        $operations = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Operations/Index', [
            'operations' => $operations,
            'filters' => ['search' => $search, 'status' => $status, 'difficulty' => $difficulty],
            'metrics' => $this->indexMetrics(),
        ]);
    }

    /**
     * Cifras de cabecera del listado.
     *
     * Se calculan sobre el catalogo activo de la empresa, no sobre la pagina: un promedio
     * de las quince operaciones que se ven no es el promedio del taller. Una sola consulta
     * agregada en lugar de cuatro viajes a la base.
     *
     * @return array{avg_price: float, avg_minutes: float, active: int, avg_difficulty_level: int}
     */
    protected function indexMetrics(): array
    {
        $row = Operation::query()
            ->where('is_active', true)
            ->selectRaw('
                AVG(base_price) as avg_price,
                AVG(estimated_minutes) as avg_minutes,
                AVG(difficulty_level) as avg_difficulty,
                COUNT(*) as active
            ')
            ->first();

        return [
            'avg_price' => round((float) ($row->avg_price ?? 0), 2),
            'avg_minutes' => round((float) ($row->avg_minutes ?? 0), 2),
            'active' => (int) ($row->active ?? 0),
            'avg_difficulty_level' => (int) round((float) ($row->avg_difficulty ?? 0)),
        ];
    }

    public function create(): Response
    {
        return Inertia::render('Operations/Create');
    }

    public function store(StoreOperationRequest $request): RedirectResponse|JsonResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;

        $thresholds = OperationDifficulty::thresholdsFor(Company::find($data['company_id']));
        $data['difficulty_level'] = OperationDifficulty::levelFromMinutes((float) $data['estimated_minutes'], $thresholds);

        $operation = Operation::create($data);

        if ($request->wantsJson()) {
            return response()->json($operation);
        }

        return redirect()->route('operations.index')->with('success', 'Operacion creada.');
    }

    /**
     * Ficha de la operacion: donde se usa y cuanto se ha producido con ella.
     */
    public function show(Operation $operation): Response
    {
        $operation->loadCount(['references', 'productions']);

        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        // Sin scopes: la produccion de una operacion puede haberse registrado con otro
        // company_id historico y sigue siendo produccion de esta operacion.
        $monthRow = Production::query()
            ->withoutGlobalScopes()
            ->where('operation_id', $operation->id)
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->selectRaw('
                SUM(quantity) as units,
                SUM(total_value) as value,
                COUNT(DISTINCT employee_id) as people,
                COUNT(DISTINCT date) as days
            ')
            ->first();

        $units = (int) ($monthRow->units ?? 0);
        $days = (int) ($monthRow->days ?? 0);

        $references = $operation->references()
            ->orderBy('references.code')
            ->get(['references.id', 'references.code', 'references.name', 'references.is_active'])
            ->map(fn ($reference) => [
                'id' => $reference->id,
                'code' => $reference->code,
                'name' => $reference->name,
                'is_active' => (bool) $reference->is_active,
                'price' => (float) $reference->pivot->price,
                'minutes' => $reference->pivot->estimated_minutes !== null
                    ? (float) $reference->pivot->estimated_minutes
                    : null,
                'pivot_is_active' => (bool) $reference->pivot->is_active,
            ])
            ->all();

        $productions = Production::query()
            ->withoutGlobalScopes()
            ->where('operation_id', $operation->id)
            ->with(['employee:id,first_name,last_name', 'reference:id,code,name'])
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (Production $production) => [
                'id' => $production->id,
                'date' => $production->date?->format('Y-m-d'),
                'employee' => trim(($production->employee?->first_name ?? '').' '.($production->employee?->last_name ?? '')),
                'reference_code' => $production->reference?->code,
                'reference_name' => $production->reference?->name,
                'quantity' => (int) $production->quantity,
                'total_value' => (float) $production->total_value,
            ])
            ->all();

        return Inertia::render('Operations/Show', [
            'operation' => $operation,
            'metrics' => [
                'units_month' => $units,
                'value_month' => round((float) ($monthRow->value ?? 0), 2),
                'people_month' => (int) ($monthRow->people ?? 0),
                // Promedio por dia con registro, no por dia del calendario: dividir entre
                // 30 diria «12 unidades» de una operacion que solo se hace los lunes.
                'avg_daily' => $days > 0 ? (int) round($units / $days) : 0,
            ],
            'references' => $references,
            'productions' => $productions,
        ]);
    }

    public function edit(Operation $operation): Response
    {
        $operation->loadCount(['references', 'productions']);

        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        return Inertia::render('Operations/Edit', [
            'operation' => $operation,
            // El panel de uso dice si tocar esta operacion afecta a algo vivo.
            'usage' => [
                'units_month' => (int) Production::query()
                    ->withoutGlobalScopes()
                    ->where('operation_id', $operation->id)
                    ->whereBetween('date', [$monthStart, $monthEnd])
                    ->sum('quantity'),
                'last_production_at' => Production::query()
                    ->withoutGlobalScopes()
                    ->where('operation_id', $operation->id)
                    ->max('date'),
            ],
        ]);
    }

    public function update(UpdateOperationRequest $request, Operation $operation): RedirectResponse
    {
        $data = $request->validated();

        $thresholds = OperationDifficulty::thresholdsFor($operation->company);
        $data['difficulty_level'] = OperationDifficulty::levelFromMinutes((float) $data['estimated_minutes'], $thresholds);

        $operation->update($data);

        return redirect()->route('operations.index')->with('success', 'Operacion actualizada.');
    }

    /**
     * Cambia solo el precio, desde la fila del listado.
     *
     * La dificultad no se recalcula a proposito: depende de los minutos, no del precio.
     */
    public function updatePrice(UpdateOperationPriceRequest $request, Operation $operation): RedirectResponse
    {
        $operation->update(['base_price' => $request->validated()['base_price']]);

        return back()->with('success', 'Precio actualizado.');
    }

    /**
     * Copia una operacion para partir de ella.
     *
     * No se copian los vinculos con referencias: el precio de una operacion dentro de una
     * referencia es una negociacion de esa prenda, y arrastrarlo a una operacion nueva
     * pondria cifras que nadie acordo.
     */
    public function duplicate(Request $request, Operation $operation): RedirectResponse
    {
        abort_if(! $request->user()?->can('operations.index.create') && ! $request->user()?->isSuperAdmin(), 403);

        $copy = Operation::create([
            'company_id' => $operation->company_id,
            'name' => $this->availableCopyName($operation),
            'description' => $operation->description,
            'base_price' => $operation->base_price,
            'estimated_minutes' => $operation->estimated_minutes,
            'difficulty_level' => $operation->difficulty_level,
            'is_active' => true,
        ]);

        return redirect()->route('operations.edit', $copy)->with('success', 'Operacion duplicada. Revisa el nombre.');
    }

    /**
     * Primer «(copia)» libre: el nombre es unico por empresa.
     */
    protected function availableCopyName(Operation $operation): string
    {
        $base = $operation->name.' (copia)';
        $candidate = $base;
        $n = 1;

        while (Operation::query()->withoutGlobalScopes()
            ->where('company_id', $operation->company_id)
            ->whereNull('deleted_at')
            ->where('name', $candidate)
            ->exists()) {
            $n++;
            $candidate = $operation->name." (copia {$n})";
        }

        return mb_substr($candidate, 0, 120);
    }

    /**
     * Activa o inactiva varias operaciones en una sola consulta.
     */
    public function bulkStatus(BulkOperationStatusRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $ids = collect($data['ids'])->map(fn ($id) => (int) $id)->filter()->unique()->all();

        $updated = Operation::query()->whereIn('id', $ids)->update(['is_active' => $data['is_active']]);

        if ($updated === 0) {
            return back()->with('warning', 'No hubo operaciones que actualizar.');
        }

        return back()->with('success', $updated === 1
            ? '1 operacion actualizada.'
            : "{$updated} operaciones actualizadas.");
    }

    public function destroy(Operation $operation): RedirectResponse
    {
        $operation->delete();

        return redirect()->route('operations.index')->with('success', 'Operacion eliminada.');
    }
}
