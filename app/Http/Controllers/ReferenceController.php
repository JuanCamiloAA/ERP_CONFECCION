<?php

namespace App\Http\Controllers;

use App\Http\Requests\Reference\StoreReferenceRequest;
use App\Http\Requests\Reference\UpdateReferenceRequest;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use App\Support\ReferenceLotCompletion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReferenceController extends Controller
{
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
            $maxByRef = Production::query()
                ->withoutGlobalScopes()
                ->selectRaw('reference_id, MAX(op_sum) as productions_max_per_operation')
                ->fromSub(
                    Production::query()
                        ->withoutGlobalScopes()
                        ->selectRaw('reference_id, operation_id, SUM(quantity) as op_sum')
                        ->whereIn('reference_id', $ids)
                        ->groupBy('reference_id', 'operation_id'),
                    'per_op'
                )
                ->groupBy('reference_id')
                ->pluck('productions_max_per_operation', 'reference_id');
            $references->getCollection()->each(function (Reference $ref) use ($maxByRef) {
                $ref->setAttribute('productions_max_per_operation', (int) ($maxByRef[$ref->id] ?? 0));
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
            'operations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price']),
        ]);
    }

    public function store(StoreReferenceRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        return DB::transaction(function () use ($request, $data, $user) {
            if ($request->hasFile('image')) {
                $data['image'] = $request->file('image')->store('references', 'public');
            }

            $sumUnit = round(collect($data['operations'] ?? [])->sum(fn ($row) => (float) ($row['price'] ?? 0)), 2);
            $lotQty = (int) $data['lot_total_quantity'];

            $reference = Reference::create([
                'company_id' => $user->company_id,
                'code' => $data['code'],
                'name' => $data['name'],
                'payment_per_unit' => $data['payment_per_unit'],
                'operational_cost_per_unit_fixed' => $sumUnit,
                'operational_lot_qty_at_cost_fix' => $lotQty,
                'description' => $data['description'] ?? null,
                'image' => $data['image'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                'lot_total_quantity' => $lotQty,
            ]);

            if (! empty($data['operations'])) {
                $sync = collect($data['operations'])->mapWithKeys(fn ($row) => [
                    $row['operation_id'] => ['price' => $row['price'], 'is_active' => true],
                ])->all();
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
            'allOperations' => Operation::active()->orderBy('name')->get(['id', 'name', 'base_price']),
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

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('references', 'public');
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
        ]);

        $reference->operations()->syncWithoutDetaching([
            $request->input('operation_id') => [
                'price' => $request->input('price'),
                'is_active' => true,
            ],
        ]);

        return back()->with('success', 'Operacion asociada.');
    }

    public function updateOperationPrice(Request $request, Reference $reference, Operation $operation): RedirectResponse
    {
        $request->validate([
            'price' => ['required', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $reference->operations()->updateExistingPivot($operation->id, [
            'price' => $request->input('price'),
            'is_active' => (bool) $request->input('is_active', true),
        ]);

        return back()->with('success', 'Precio actualizado.');
    }

    public function detachOperation(Reference $reference, Operation $operation): RedirectResponse
    {
        $reference->operations()->detach($operation->id);

        return back()->with('success', 'Operacion desasociada.');
    }
}
