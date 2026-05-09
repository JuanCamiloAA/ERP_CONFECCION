<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseCategory\StoreExpenseCategoryRequest;
use App\Http\Requests\ExpenseCategory\UpdateExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        $query = ExpenseCategory::query()
            ->with('company:id,name')
            ->withCount(['expenses' => fn ($q) => $q->whereNull('deleted_at')]);

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        $categories = $query->orderBy('sort_order')->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Expenses/Categories/Index', [
            'categories' => $categories,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Expenses/Categories/Create');
    }

    public function store(StoreExpenseCategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;
        ExpenseCategory::create($data);

        return redirect()->route('expense-categories.index')->with('success', 'Categoría creada.');
    }

    public function edit(ExpenseCategory $expenseCategory): Response
    {
        return Inertia::render('Expenses/Categories/Edit', [
            'category' => $expenseCategory,
        ]);
    }

    public function update(UpdateExpenseCategoryRequest $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        $expenseCategory->update($request->validated());

        return redirect()->route('expense-categories.index')->with('success', 'Categoría actualizada.');
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
