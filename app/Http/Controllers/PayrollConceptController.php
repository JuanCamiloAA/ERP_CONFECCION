<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\ReorderCatalogRequest;
use App\Http\Requests\PayrollConcept\StorePayrollConceptRequest;
use App\Http\Requests\PayrollConcept\UpdatePayrollConceptRequest;
use App\Models\PayrollConcept;
use App\Models\PayrollEmployeeAdjustment;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PayrollConceptController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(PayrollConcept::class, 'payroll_concept');
    }

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['active', 'inactive', 'all'], true)) {
            $status = 'all';
        }

        $query = PayrollConcept::query()
            ->with('company:id,name')
            ->withCount('adjustments');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Sin paginar, igual que el catalogo de categorias: son pocas filas y el orden es
        // parte del dato.
        $concepts = $query->orderBy('sort_order')->orderBy('name')->get();

        $usage = $this->usageByConcept();

        return Inertia::render('PayrollConcepts/Index', [
            'concepts' => $concepts->map(fn (PayrollConcept $concept) => [
                'id' => $concept->id,
                'name' => $concept->name,
                'code' => $concept->code,
                'description' => $concept->description,
                'is_active' => (bool) $concept->is_active,
                'sort_order' => (int) $concept->sort_order,
                'adjustments_count' => (int) $concept->adjustments_count,
                'adjustments_total' => round((float) ($usage[$concept->id]['total'] ?? 0), 2),
                'last_used_at' => $usage[$concept->id]['last_used_at'] ?? null,
                'company' => $concept->company ? ['id' => $concept->company->id, 'name' => $concept->company->name] : null,
            ])->values(),
            'filters' => ['search' => $search, 'status' => $status],
            'summary' => $this->summary($usage),
        ]);
    }

    /**
     * Lo pagado por cada concepto en el año en curso y cuando se uso por ultima vez.
     *
     * «Uso en nominas: 24» no dice si son 24 bonos de mil pesos o de un millon; el total
     * y la fecha si.
     *
     * @return array<int, array{total: float, last_used_at: ?string}>
     */
    protected function usageByConcept(): array
    {
        return PayrollEmployeeAdjustment::query()
            ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
            ->selectRaw('payroll_concept_id, SUM(amount) as total, MAX(created_at) as last_used_at')
            ->groupBy('payroll_concept_id')
            ->get()
            ->mapWithKeys(fn ($row) => [
                (int) $row->payroll_concept_id => [
                    'total' => round((float) $row->total, 2),
                    'last_used_at' => $row->last_used_at ? (string) $row->last_used_at : null,
                ],
            ])
            ->all();
    }

    /**
     * @param  array<int, array{total: float, last_used_at: ?string}>  $usage
     * @return array<string, mixed>
     */
    protected function summary(array $usage): array
    {
        return [
            'total' => PayrollConcept::query()->count(),
            'active' => PayrollConcept::query()->where('is_active', true)->count(),
            'year_adjustments' => PayrollEmployeeAdjustment::query()
                ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
                ->count(),
            'year_total' => round(array_sum(array_column($usage, 'total')), 2),
        ];
    }

    public function create(): Response
    {
        return Inertia::render('PayrollConcepts/Create', [
            'siblings' => $this->siblings(),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function siblings(): array
    {
        return PayrollConcept::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (PayrollConcept $concept) => [
                'id' => $concept->id,
                'name' => $concept->name,
                'is_active' => (bool) $concept->is_active,
            ])
            ->values()
            ->all();
    }

    public function store(StorePayrollConceptRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;
        $concept = PayrollConcept::create($data);

        $this->resequence($concept, (int) $data['sort_order']);

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto de nómina creado.');
    }

    /**
     * Renumera el catalogo dejando el concepto en la posicion pedida.
     *
     * El formulario manda una posicion dentro de la lista, no un numero suelto: si solo
     * se escribiera `sort_order` en esta fila, dos conceptos compartirian el mismo valor
     * y el orden final no seria el que el usuario acaba de ver.
     */
    protected function resequence(PayrollConcept $concept, int $position): void
    {
        $others = PayrollConcept::query()
            ->whereKeyNot($concept->id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $ordered = $others->values()->all();
        array_splice($ordered, max(0, min($position, count($ordered))), 0, [$concept]);

        DB::transaction(function () use ($ordered) {
            foreach ($ordered as $index => $row) {
                if ((int) $row->sort_order !== $index) {
                    PayrollConcept::query()->whereKey($row->id)->update(['sort_order' => $index]);
                }
            }
        });
    }

    public function edit(PayrollConcept $payrollConcept): Response
    {
        return Inertia::render('PayrollConcepts/Edit', [
            'concept' => [
                'id' => $payrollConcept->id,
                'name' => $payrollConcept->name,
                'code' => $payrollConcept->code,
                'description' => $payrollConcept->description,
                'is_active' => (bool) $payrollConcept->is_active,
                'sort_order' => (int) $payrollConcept->sort_order,
            ],
            'siblings' => $this->siblings(),
            'usage' => $this->usageFor($payrollConcept),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function usageFor(PayrollConcept $concept): array
    {
        $adjustments = PayrollEmployeeAdjustment::query()->where('payroll_concept_id', $concept->id);

        return [
            'count' => (clone $adjustments)->count(),
            'year_total' => round((float) (clone $adjustments)
                ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
                ->sum('amount'), 2),
            'last_used_at' => (clone $adjustments)->max('created_at'),
        ];
    }

    public function update(UpdatePayrollConceptRequest $request, PayrollConcept $payrollConcept): RedirectResponse
    {
        $data = $request->validated();
        $payrollConcept->update($data);

        $this->resequence($payrollConcept, (int) ($data['sort_order'] ?? $payrollConcept->sort_order));

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto actualizado.');
    }

    public function toggleActive(PayrollConcept $payrollConcept): RedirectResponse
    {
        $this->authorize('update', $payrollConcept);

        $payrollConcept->update(['is_active' => ! $payrollConcept->is_active]);

        return back()->with(
            'success',
            $payrollConcept->is_active
                ? "«{$payrollConcept->name}» vuelve a aparecer al agregar un ajuste."
                : "«{$payrollConcept->name}» deja de aparecer al agregar ajustes; las nóminas ya liquidadas no cambian.",
        );
    }

    public function reorder(ReorderCatalogRequest $request): RedirectResponse
    {
        $this->authorize('create', PayrollConcept::class);

        $ids = collect($request->validated()['order'])->pluck('id')->all();
        $owned = PayrollConcept::query()->whereIn('id', $ids)->pluck('id')->all();

        DB::transaction(function () use ($request, $owned) {
            foreach ($request->validated()['order'] as $row) {
                if (! in_array((int) $row['id'], $owned, true)) {
                    continue;
                }

                PayrollConcept::query()->whereKey($row['id'])->update(['sort_order' => (int) $row['sort_order']]);
            }
        });

        return back()->with('success', 'Orden actualizado.');
    }

    public function destroy(PayrollConcept $payrollConcept): RedirectResponse
    {
        if ($payrollConcept->adjustments()->exists()) {
            return redirect()->route('payroll-concepts.index')->with(
                'error',
                'No se puede eliminar: el concepto tiene ajustes en nóminas. Desactívalo en su lugar.',
            );
        }

        $payrollConcept->delete();

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto eliminado.');
    }
}
