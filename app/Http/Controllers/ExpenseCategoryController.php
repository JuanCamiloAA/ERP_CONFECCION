<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\ReorderCatalogRequest;
use App\Http\Requests\ExpenseCategory\StoreExpenseCategoryRequest;
use App\Http\Requests\ExpenseCategory\UpdateExpenseCategoryRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseCategoryController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(ExpenseCategory::class, 'expense_category');
    }

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['active', 'inactive', 'all'], true)) {
            $status = 'all';
        }

        $query = ExpenseCategory::query()
            ->with('company:id,name')
            ->withCount(['expenses' => fn ($q) => $q->whereNull('deleted_at')]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Sin paginar: un catalogo de 5-15 filas que ademas se reordena en sitio. Paginar
        // rompe el reordenamiento (mover una fila a la pagina anterior no tiene UI posible).
        $categories = $query->orderBy('sort_order')->orderBy('name')->get();

        $monthTotals = $this->monthTotalsByCategory();

        return Inertia::render('Expenses/Categories/Index', [
            'categories' => $categories->map(fn (ExpenseCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'is_active' => (bool) $category->is_active,
                'sort_order' => (int) $category->sort_order,
                'expenses_count' => (int) $category->expenses_count,
                'month_total' => round((float) ($monthTotals[$category->id] ?? 0), 2),
                'company' => $category->company ? ['id' => $category->company->id, 'name' => $category->company->name] : null,
            ])->values(),
            'filters' => ['search' => $search, 'status' => $status],
            'summary' => $this->summary($monthTotals),
        ]);
    }

    /**
     * Gasto del mes en curso por categoria. Es lo que convierte «24 gastos» en una cifra
     * con la que se puede decidir algo.
     *
     * @return array<int, float>
     */
    protected function monthTotalsByCategory(): array
    {
        return Expense::query()
            ->whereBetween('expense_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->selectRaw('category_id, SUM(amount) as total')
            ->groupBy('category_id')
            ->pluck('total', 'category_id')
            ->map(fn ($total) => round((float) $total, 2))
            ->all();
    }

    /**
     * @param  array<int, float>  $monthTotals
     * @return array<string, mixed>
     */
    protected function summary(array $monthTotals): array
    {
        return [
            'total' => ExpenseCategory::query()->count(),
            'active' => ExpenseCategory::query()->where('is_active', true)->count(),
            'with_movement' => count(array_filter($monthTotals, fn ($total) => $total > 0)),
            'month_total' => round(array_sum($monthTotals), 2),
        ];
    }

    public function create(): Response
    {
        return Inertia::render('Expenses/Categories/Create', [
            'siblings' => $this->siblings(),
        ]);
    }

    /**
     * Hermanos del catalogo, en su orden real: es la lista sobre la que se mueve el
     * registro en lugar de escribir un numero a ciegas.
     *
     * @return list<array<string, mixed>>
     */
    protected function siblings(): array
    {
        return ExpenseCategory::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (ExpenseCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'is_active' => (bool) $category->is_active,
            ])
            ->values()
            ->all();
    }

    public function store(StoreExpenseCategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;
        $category = ExpenseCategory::create($data);

        $this->resequence($category, (int) ($data['sort_order'] ?? 0));

        return redirect()->route('expense-categories.index')->with('success', 'Categoría creada.');
    }

    /**
     * Renumera el catalogo dejando la categoria en la posicion pedida.
     *
     * El formulario manda una posicion dentro de la lista, no un numero suelto: si solo
     * se escribiera `sort_order` en esta fila, dos categorias compartirian el mismo valor
     * y el orden final no seria el que el usuario acaba de ver.
     */
    protected function resequence(ExpenseCategory $category, int $position): void
    {
        $others = ExpenseCategory::query()
            ->whereKeyNot($category->id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $ordered = $others->values()->all();
        array_splice($ordered, max(0, min($position, count($ordered))), 0, [$category]);

        DB::transaction(function () use ($ordered) {
            foreach ($ordered as $index => $row) {
                if ((int) $row->sort_order !== $index) {
                    ExpenseCategory::query()->whereKey($row->id)->update(['sort_order' => $index]);
                }
            }
        });
    }

    public function edit(ExpenseCategory $expenseCategory): Response
    {
        $monthTotals = $this->monthTotalsByCategory();

        return Inertia::render('Expenses/Categories/Edit', [
            'category' => [
                'id' => $expenseCategory->id,
                'name' => $expenseCategory->name,
                'description' => $expenseCategory->description,
                'is_active' => (bool) $expenseCategory->is_active,
                'sort_order' => (int) $expenseCategory->sort_order,
            ],
            'siblings' => $this->siblings(),
            'usage' => $this->usageFor($expenseCategory, $monthTotals),
        ]);
    }

    /**
     * Uso real de la categoria: lo que decide si se puede eliminar y lo que explica por
     * que no.
     *
     * @param  array<int, float>  $monthTotals
     * @return array<string, mixed>
     */
    protected function usageFor(ExpenseCategory $category, array $monthTotals): array
    {
        $expenses = Expense::query()->where('category_id', $category->id);

        $yearTotal = (clone $expenses)
            ->whereBetween('expense_date', [now()->startOfYear()->toDateString(), now()->endOfYear()->toDateString()])
            ->sum('amount');

        return [
            'count' => (clone $expenses)->count(),
            // Con archivados: el servidor tambien los cuenta al bloquear el borrado.
            'count_with_trashed' => $category->expenses()->withTrashed()->count(),
            'year_total' => round((float) $yearTotal, 2),
            'month_total' => round((float) ($monthTotals[$category->id] ?? 0), 2),
            'last_used_at' => (clone $expenses)->max('expense_date'),
        ];
    }

    public function update(UpdateExpenseCategoryRequest $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        $data = $request->validated();
        $expenseCategory->update($data);

        $this->resequence($expenseCategory, (int) ($data['sort_order'] ?? $expenseCategory->sort_order));

        return redirect()->route('expense-categories.index')->with('success', 'Categoría actualizada.');
    }

    /**
     * Enciende o apaga la categoria sin salir del listado.
     */
    public function toggleActive(ExpenseCategory $expenseCategory): RedirectResponse
    {
        $this->authorize('update', $expenseCategory);

        $expenseCategory->update(['is_active' => ! $expenseCategory->is_active]);

        return back()->with(
            'success',
            $expenseCategory->is_active
                ? "«{$expenseCategory->name}» vuelve a aparecer al registrar un gasto."
                : "«{$expenseCategory->name}» deja de aparecer al registrar; los gastos ya registrados no cambian.",
        );
    }

    /**
     * Persiste el orden del catalogo en una transaccion.
     */
    public function reorder(ReorderCatalogRequest $request): RedirectResponse
    {
        $this->authorize('create', ExpenseCategory::class);

        $ids = collect($request->validated()['order'])->pluck('id')->all();

        // Se acotan a las de la empresa activa antes de escribir: el cliente manda ids y
        // no puede decidir sobre filas ajenas.
        $owned = ExpenseCategory::query()->whereIn('id', $ids)->pluck('id')->all();

        DB::transaction(function () use ($request, $owned) {
            foreach ($request->validated()['order'] as $row) {
                if (! in_array((int) $row['id'], $owned, true)) {
                    continue;
                }

                ExpenseCategory::query()->whereKey($row['id'])->update(['sort_order' => (int) $row['sort_order']]);
            }
        });

        return back()->with('success', 'Orden actualizado.');
    }

    public function destroy(ExpenseCategory $expenseCategory): RedirectResponse
    {
        if ($expenseCategory->expenses()->withTrashed()->exists()) {
            return redirect()->route('expense-categories.index')->with(
                'error',
                'No se puede eliminar: existen gastos asociados a esta categoría (incluidos archivados).',
            );
        }

        $expenseCategory->delete();

        return redirect()->route('expense-categories.index')->with('success', 'Categoría eliminada.');
    }
}
