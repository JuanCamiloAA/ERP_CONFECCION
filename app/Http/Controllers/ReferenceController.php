<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Reference\StoreReferenceRequest;
use App\Http\Requests\Reference\UpdateReferenceRequest;
use App\Models\Company;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use App\Services\Files\StoredFileDeleter;
use App\Services\References\ReferenceDifficultySync;
use App\Support\OperationDifficulty;
use App\Support\ReferenceLotCompletion;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReferenceController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = Reference::query()
            ->withCount('operations')
            ->withCount('productions')
            ->withSum('productions', 'quantity');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $references = $query->orderBy('code')->paginate(15)->withQueryString();

        $ids = $references->getCollection()->pluck('id');
        if ($ids->isNotEmpty()) {
            // Produccion acumulada por operacion (una fila por referencia+operacion).
            $perOperation = Production::query()
                ->withoutGlobalScopes()
                ->selectRaw('reference_id, operation_id, SUM(quantity) as op_sum')
                ->whereIn('reference_id', $ids)
                ->groupBy('reference_id', 'operation_id')
                ->get()
                ->groupBy('reference_id');

            $references->getCollection()->each(function (Reference $ref) use ($perOperation) {
                $sums = $perOperation->get($ref->id) ?? collect();
                $lot = $ref->lot_total_quantity !== null ? (int) $ref->lot_total_quantity : null;

                $ref->setAttribute('productions_max_per_operation', (int) $sums->max('op_sum'));

                // Una operacion se considera completa cuando su produccion acumulada cubre
                // el lote. Sin lote definido no hay meta contra la cual compararla.
                $ref->setAttribute(
                    'operations_completed_count',
                    $lot !== null && $lot > 0
                        ? $sums->filter(fn ($row) => (int) $row->op_sum >= $lot)->count()
                        : 0
                );
            });
        }

        return Inertia::render('References/Index', [
            'references' => $references,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('References/Create', [
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level']),
        ]);
    }

    public function store(StoreReferenceRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        return DB::transaction(function () use ($request, $data, $user) {
            $sumUnit = round(collect($data['operations'] ?? [])->sum(fn ($row) => (float) ($row['price'] ?? 0)), 2);
            $lotQty = (int) $data['lot_total_quantity'];

            $reference = Reference::create([
                'company_id' => TenantContext::requireCompanyIdForWrite($user),
                'code' => $data['code'],
                'name' => $data['name'],
                'payment_per_unit' => $data['payment_per_unit'],
                'operational_cost_per_unit_fixed' => $sumUnit,
                'operational_lot_qty_at_cost_fix' => $lotQty,
                'description' => $data['description'] ?? null,
                'image' => null,
                'is_active' => $data['is_active'] ?? true,
                'lot_total_quantity' => $lotQty,
            ]);

            if ($request->hasFile('image')) {
                $uploaded = $this->objectStorage->upload(
                    $request->file('image'),
                    "companies/{$reference->company_id}/references/{$reference->id}"
                );
                $reference->update(['image' => $uploaded['path']]);
            }

            if (! empty($data['operations'])) {
                $thresholds = OperationDifficulty::thresholdsFor($reference->company);
                $sync = collect($data['operations'])->mapWithKeys(function ($row) use ($thresholds) {
                    $minutes = $row['estimated_minutes'] ?? null;

                    return [
                        $row['operation_id'] => [
                            'price' => $row['price'],
                            'estimated_minutes' => $minutes,
                            'difficulty_level' => $minutes !== null && $minutes !== ''
                                ? OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds)
                                : null,
                            'is_active' => true,
                        ],
                    ];
                })->all();
                $reference->operations()->sync($sync);
            }

            return redirect()->route('references.show', $reference)->with('success', 'Referencia creada.');
        });
    }

    public function show(Reference $reference): Response
    {
        $reference->load(['operations', 'company']);
        $reference->loadSum('productions', 'quantity');

        return Inertia::render('References/Show', [
            'reference' => $reference,
            'allOperations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level']),
            'comparison' => $this->buildEconomicsComparison($reference),
        ]);
    }

    public function edit(Reference $reference): Response
    {
        $reference->load(['operations', 'company']);

        return Inertia::render('References/Edit', [
            'reference' => $reference,
            'comparison' => $this->buildEconomicsComparison($reference),
        ]);
    }

    public function update(UpdateReferenceRequest $request, Reference $reference): RedirectResponse
    {
        $data = $request->validated();
        unset($data['image']);

        if ($request->hasFile('image')) {
            $this->storedFileDeleter->deleteIfPresent($reference->getAttributes()['image'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('image'),
                "companies/{$reference->company_id}/references/{$reference->id}"
            );
            $data['image'] = $uploaded['path'];
        }

        $reference->update($data);

        $reference->refresh();
        ReferenceLotCompletion::sync((int) $reference->id);

        return redirect()->route('references.show', $reference)->with('success', 'Referencia actualizada.');
    }

    public function destroy(Reference $reference): RedirectResponse
    {
        $reference->delete();

        return redirect()->route('references.index')->with('success', 'Referencia eliminada.');
    }

    /**
     * @return array{
     *     payment_per_unit: float,
     *     production_cost_per_unit: float,
     *     margin_per_unit: float,
     *     has_operations: bool,
     *     payment_per_unit_incomplete: bool,
     *     currency: string,
     *     operational_lot_qty_at_cost_fix: int,
     *     total_operational_at_creation: float
     * }
     */
    protected function buildEconomicsComparison(Reference $reference): array
    {
        $reference->loadMissing('company');

        $hasOperations = $reference->referenceOperations()->exists();
        $payment = (float) ($reference->payment_per_unit ?? 0);
        $cost = $reference->productionCostPerUnit();
        $settings = $reference->company?->settings ?? [];
        $currency = is_array($settings) ? (string) ($settings['currency'] ?? 'COP') : 'COP';
        $paymentMissing = ($reference->getAttributes()['payment_per_unit'] ?? null) === null;
        $lotSnap = (int) ($reference->operational_lot_qty_at_cost_fix ?? 0);
        $totalAtCreation = round($cost * $lotSnap, 2);

        return [
            'payment_per_unit' => $payment,
            'production_cost_per_unit' => $cost,
            'margin_per_unit' => round($payment - $cost, 2),
            'has_operations' => $hasOperations,
            'payment_per_unit_incomplete' => $paymentMissing,
            'currency' => $currency,
            'operational_lot_qty_at_cost_fix' => $lotSnap,
            'total_operational_at_creation' => $totalAtCreation,
        ];
    }

    public function attachOperation(Request $request, Reference $reference): RedirectResponse
    {
        $request->validate([
            'operation_id' => ['required', 'integer', 'exists:operations,id'],
            'price' => ['required', 'numeric', 'min:0'],
            'estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
        ]);

        $minutes = $request->input('estimated_minutes');
        $difficultyLevel = null;
        if ($minutes !== null && $minutes !== '') {
            $thresholds = OperationDifficulty::thresholdsFor($reference->company);
            $difficultyLevel = OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds);
        }

        $reference->operations()->syncWithoutDetaching([
            $request->input('operation_id') => [
                'price' => $request->input('price'),
                'estimated_minutes' => $minutes,
                'difficulty_level' => $difficultyLevel,
                'is_active' => true,
            ],
        ]);

        return back()->with('success', 'Operacion asociada.');
    }

    public function updateOperationPrice(Request $request, Reference $reference, Operation $operation): RedirectResponse
    {
        $request->validate([
            'price' => ['required', 'numeric', 'min:0'],
            'estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $minutes = $request->input('estimated_minutes');
        $difficultyLevel = null;
        if ($minutes !== null && $minutes !== '') {
            $thresholds = OperationDifficulty::thresholdsFor($reference->company);
            $difficultyLevel = OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds);
        }

        $reference->operations()->updateExistingPivot($operation->id, [
            'price' => $request->input('price'),
            'estimated_minutes' => $minutes,
            'difficulty_level' => $difficultyLevel,
            'is_active' => (bool) $request->input('is_active', true),
        ]);

        return back()->with('success', 'Precio actualizado.');
    }

    public function detachOperation(Reference $reference, Operation $operation): RedirectResponse
    {
        $reference->operations()->detach($operation->id);

        return back()->with('success', 'Operacion desasociada.');
    }

    /**
     * Reaplica los rangos de dificultad de Mi empresa a las lineas de una referencia.
     */
    public function recalculateDifficulties(Reference $reference, ReferenceDifficultySync $sync): RedirectResponse
    {
        return back()->with('success', $this->difficultyMessage($sync->forReference($reference)));
    }

    /**
     * Lo mismo, pero para todas las referencias de la empresa activa.
     */
    public function recalculateAllDifficulties(ReferenceDifficultySync $sync): RedirectResponse
    {
        $result = $sync->forAllReferences();

        return back()->with('success', sprintf(
            '%s (%d referencias)',
            $this->difficultyMessage($result),
            $result['references']
        ));
    }

    /**
     * @param  array{lines: int, changed: int, without_minutes: int}  $result
     */
    private function difficultyMessage(array $result): string
    {
        if ($result['lines'] === 0) {
            return 'No hay operaciones asociadas para recalcular.';
        }

        $message = $result['changed'] === 0
            ? sprintf('Las %d lineas ya estaban al dia.', $result['lines'])
            : sprintf('%d de %d lineas actualizaron su dificultad.', $result['changed'], $result['lines']);

        if ($result['without_minutes'] > 0) {
            $message .= sprintf(' %d sin minutos definidos quedaron sin grado.', $result['without_minutes']);
        }

        return $message;
    }
}
