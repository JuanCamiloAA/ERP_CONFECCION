<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\Files\MediaUrlResolver;
use App\Services\Files\StoredFileDeleter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
        protected MediaUrlResolver $mediaUrlResolver,
    ) {
        $this->authorizeResource(Expense::class, 'expense');
    }

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $categoryId = $request->input('category_id');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Expense::query()
            ->with(['category:id,name', 'creator:id,name,last_name', 'company:id,name']);

        if ($search !== '') {
            $query->where('description', 'like', "%{$search}%");
        }

        if ($categoryId !== null && $categoryId !== '') {
            $query->where('category_id', (int) $categoryId);
        }

        if ($dateFrom) {
            $query->whereDate('expense_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('expense_date', '<=', $dateTo);
        }

        $expenses = $query->orderByDesc('expense_date')->orderByDesc('id')->paginate(15)->withQueryString();

        $expenses->through(fn (Expense $e) => $this->toExpenseRow($e));

        $categoryOptions = ExpenseCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'categoryOptions' => $categoryOptions,
            'filters' => [
                'search' => $search,
                'category_id' => $categoryId === '' ? null : $categoryId,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    public function create(): Response
    {
        $categories = ExpenseCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Expenses/Create', [
            'categories' => $categories,
        ]);
    }

    public function store(StoreExpenseRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = collect($request->validated())->except(['receipt'])->all();
        $companyId = TenantContext::requireCompanyIdForWrite($user);
        $data['company_id'] = $companyId;
        $data['created_by'] = $user->id;

        $expense = Expense::create($data);

        if ($request->hasFile('receipt')) {
            $uploaded = $this->objectStorage->upload(
                $request->file('receipt'),
                "companies/{$companyId}/expenses/{$expense->id}"
            );
            $file = $request->file('receipt');
            $expense->update([
                'receipt_path' => $uploaded['path'],
                'receipt_original_name' => $file->getClientOriginalName(),
                'receipt_mime' => $file->getClientMimeType(),
            ]);
        }

        return redirect()->route('expenses.index')->with('success', 'Gasto registrado.');
    }

    public function show(Expense $expense): Response
    {
        $expense->load(['category:id,name', 'creator:id,name,last_name,email']);

        return Inertia::render('Expenses/Show', [
            'expense' => $this->toExpenseDetail($expense),
        ]);
    }

    public function edit(Expense $expense): Response
    {
        $categories = ExpenseCategory::query()
            ->where(function ($q) use ($expense) {
                $q->where('is_active', true)
                    ->orWhere('id', $expense->category_id);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'is_active']);

        return Inertia::render('Expenses/Edit', [
            'expense' => $this->toExpenseDetail($expense),
            'categories' => $categories,
        ]);
    }

    public function update(UpdateExpenseRequest $request, Expense $expense): RedirectResponse
    {
        $data = collect($request->validated())->except(['receipt'])->all();
        $expense->update($data);

        if ($request->hasFile('receipt')) {
            $this->storedFileDeleter->deleteIfPresent($expense->receipt_path);
            $uploaded = $this->objectStorage->upload(
                $request->file('receipt'),
                "companies/{$expense->company_id}/expenses/{$expense->id}"
            );
            $file = $request->file('receipt');
            $expense->update([
                'receipt_path' => $uploaded['path'],
                'receipt_original_name' => $file->getClientOriginalName(),
                'receipt_mime' => $file->getClientMimeType(),
            ]);
        }

        return redirect()->route('expenses.index')->with('success', 'Gasto actualizado.');
    }

    public function destroy(Expense $expense): RedirectResponse
    {
        $expense->delete();

        return redirect()->route('expenses.index')->with('success', 'Gasto eliminado.');
    }

    /**
     * @return array<string, mixed>
     */
    protected function toExpenseRow(Expense $expense): array
    {
        return [
            'id' => $expense->id,
            'amount' => (float) $expense->amount,
            'description' => $expense->description,
            'expense_date' => $expense->expense_date->toDateString(),
            'created_at' => $expense->created_at?->toIso8601String(),
            'receipt_url' => $this->mediaUrlResolver->url($expense->receipt_path),
            'receipt_mime' => $expense->receipt_mime,
            'category' => $expense->category ? [
                'id' => $expense->category->id,
                'name' => $expense->category->name,
            ] : null,
            'creator' => $expense->creator ? [
                'id' => $expense->creator->id,
                'full_name' => trim(($expense->creator->name ?? '').' '.($expense->creator->last_name ?? '')),
            ] : null,
            'company' => $expense->company ? [
                'id' => $expense->company->id,
                'name' => $expense->company->name,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function toExpenseDetail(Expense $expense): array
    {
        $row = $this->toExpenseRow($expense);

        return array_merge($row, [
            'notes' => $expense->notes,
            'receipt_original_name' => $expense->receipt_original_name,
            'creator' => $expense->creator ? [
                'id' => $expense->creator->id,
                'full_name' => trim(($expense->creator->name ?? '').' '.($expense->creator->last_name ?? '')),
                'email' => $expense->creator->email,
            ] : null,
        ]);
    }
}
