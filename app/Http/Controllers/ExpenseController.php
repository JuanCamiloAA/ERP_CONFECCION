<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Expense\QuickStoreExpenseRequest;
use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\Files\MediaUrlResolver;
use App\Services\Files\StoredFileDeleter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use League\Csv\Bom;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpenseController extends Controller
{
    /** Periodos del segmentado del listado; el que no venga en esta lista cae en «mes». */
    protected const PERIODS = ['mes', 'trimestre', 'anio', 'todos'];

    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
        protected MediaUrlResolver $mediaUrlResolver,
    ) {
        $this->authorizeResource(Expense::class, 'expense');
    }

    public function index(Request $request): Response
    {
        $filters = $this->resolveFilters($request);

        $query = Expense::query()
            ->with(['category:id,name', 'creator:id,name,last_name', 'company:id,name']);

        $this->applyFilters($query, $filters);

        $expenses = $query->orderByDesc('expense_date')->orderByDesc('id')->paginate(15)->withQueryString();
        $expenses->through(fn (Expense $e) => $this->toExpenseRow($e));

        // El total del filtro se calcula aparte: sumar la pagina daria una cifra que
        // cambia al pasar de pagina, que es peor que no mostrarla.
        $filteredQuery = Expense::query();
        $this->applyFilters($filteredQuery, $filters);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'categoryOptions' => ExpenseCategory::query()
                ->orderBy('sort_order')->orderBy('name')
                ->get(['id', 'name', 'is_active']),
            'filters' => $filters,
            'filteredTotal' => round((float) $filteredQuery->sum('amount'), 2),
            'metrics' => $this->indexMetrics(),
        ]);
    }

    /**
     * Filtros saneados. Un solo sitio los interpreta para que el listado y la
     * exportacion no puedan divergir.
     *
     * @return array<string, mixed>
     */
    protected function resolveFilters(Request $request): array
    {
        $period = (string) $request->input('period', 'mes');
        if (! in_array($period, self::PERIODS, true)) {
            $period = 'mes';
        }

        $categoryId = $request->input('category_id');

        return [
            'search' => trim((string) $request->input('search', '')),
            'category_id' => $categoryId === null || $categoryId === '' ? null : (int) $categoryId,
            'period' => $period,
            'date_from' => $request->input('date_from') ?: null,
            'date_to' => $request->input('date_to') ?: null,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function applyFilters($query, array $filters): void
    {
        if ($filters['search'] !== '') {
            $term = $filters['search'];
            // La nota lleva el numero de factura o la guia; buscar solo en la descripcion
            // dejaba fuera el dato por el que la gente busca de verdad.
            $query->where(function ($q) use ($term) {
                $q->where('description', 'like', "%{$term}%")
                    ->orWhere('notes', 'like', "%{$term}%");
            });
        }

        if ($filters['category_id']) {
            $query->where('category_id', $filters['category_id']);
        }

        // Un rango explicito manda sobre el segmentado: si el usuario escribio fechas,
        // son las suyas.
        if ($filters['date_from'] || $filters['date_to']) {
            if ($filters['date_from']) {
                $query->whereDate('expense_date', '>=', $filters['date_from']);
            }
            if ($filters['date_to']) {
                $query->whereDate('expense_date', '<=', $filters['date_to']);
            }

            return;
        }

        [$from, $to] = $this->periodRange($filters['period']);

        if ($from !== null) {
            $query->whereBetween('expense_date', [$from, $to]);
        }
    }

    /**
     * Rango de fechas del periodo. `todos` devuelve null y no acota nada.
     *
     * @return array{0: ?string, 1: ?string}
     */
    protected function periodRange(string $period): array
    {
        return match ($period) {
            'mes' => [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()],
            // Tres meses naturales contando el actual: es como se lee un trimestre movil.
            'trimestre' => [now()->subMonthsNoOverflow(2)->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()],
            'anio' => [now()->startOfYear()->toDateString(), now()->endOfYear()->toDateString()],
            default => [null, null],
        };
    }

    /**
     * Cifras de cabecera: siempre sobre toda la empresa, nunca sobre la pagina ni el filtro.
     *
     * @return array<string, mixed>
     */
    protected function indexMetrics(): array
    {
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();
        $prevStart = now()->subMonthNoOverflow()->startOfMonth()->toDateString();
        $prevEnd = now()->subMonthNoOverflow()->endOfMonth()->toDateString();

        $month = Expense::query()
            ->whereBetween('expense_date', [$monthStart, $monthEnd])
            ->selectRaw('SUM(amount) as total, COUNT(*) as count, COUNT(DISTINCT category_id) as categories')
            ->first();

        $year = Expense::query()
            ->whereBetween('expense_date', [now()->startOfYear()->toDateString(), now()->endOfYear()->toDateString()])
            ->selectRaw('SUM(amount) as total, COUNT(DISTINCT DATE_FORMAT(expense_date, "%Y-%m")) as months')
            ->first();

        return [
            'month_total' => round((float) ($month->total ?? 0), 2),
            'month_count' => (int) ($month->count ?? 0),
            'month_categories' => (int) ($month->categories ?? 0),
            'prev_month_total' => round((float) Expense::query()
                ->whereBetween('expense_date', [$prevStart, $prevEnd])->sum('amount'), 2),
            'year_total' => round((float) ($year->total ?? 0), 2),
            'year_months' => (int) ($year->months ?? 0),
        ];
    }

    /**
     * Descarga en CSV lo que muestra el listado, con el filtro vigente.
     */
    public function export(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Expense::class);

        $filters = $this->resolveFilters($request);

        $query = Expense::query()->with(['category:id,name', 'creator:id,name,last_name']);
        $this->applyFilters($query, $filters);

        $filename = 'gastos-'.now()->format('Ymd-Hi').'.csv';

        return response()->streamDownload(function () use ($query) {
            $writer = Writer::createFromStream(fopen('php://output', 'w'));
            $writer->setOutputBOM(Bom::Utf8);
            $writer->insertOne(['Fecha', 'Categoría', 'Descripción', 'Monto', 'Comprobante', 'Notas', 'Registró', 'Registrado el']);

            $query->orderByDesc('expense_date')->orderByDesc('id')->chunk(500, function ($rows) use ($writer) {
                foreach ($rows as $expense) {
                    $writer->insertOne([
                        $expense->expense_date?->format('Y-m-d'),
                        $expense->category?->name,
                        $expense->description,
                        (float) $expense->amount,
                        $expense->receipt_path ? ($expense->receipt_mime && str_contains($expense->receipt_mime, 'pdf') ? 'PDF' : 'Imagen') : 'Falta',
                        $expense->notes,
                        trim(($expense->creator?->name ?? '').' '.($expense->creator?->last_name ?? '')),
                        $expense->created_at?->format('Y-m-d H:i'),
                    ]);
                }
            });
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Expenses/Create', [
            'categories' => $this->activeCategories(),
            'monthContext' => $this->monthContext(),
        ]);
    }

    /**
     * Lo ya gastado en el mes y el reparto por categoria: es la base del panel «Impacto
     * en el mes» del formulario.
     *
     * @return array<string, mixed>
     */
    protected function monthContext(?int $excludeExpenseId = null): array
    {
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();
        $prevStart = now()->subMonthNoOverflow()->startOfMonth()->toDateString();
        $prevEnd = now()->subMonthNoOverflow()->endOfMonth()->toDateString();

        $base = fn () => Expense::query()
            ->whereBetween('expense_date', [$monthStart, $monthEnd])
            // Al editar, el gasto en curso sale de la base: si no, el panel lo contaria
            // dos veces al sumarle el monto que se esta escribiendo.
            ->when($excludeExpenseId !== null, fn ($q) => $q->whereKeyNot($excludeExpenseId));

        return [
            'month_total' => round((float) $base()->sum('amount'), 2),
            'prev_month_total' => round((float) Expense::query()
                ->whereBetween('expense_date', [$prevStart, $prevEnd])->sum('amount'), 2),
            'by_category' => $base()
                ->selectRaw('category_id, SUM(amount) as total')
                ->groupBy('category_id')
                ->pluck('total', 'category_id')
                ->map(fn ($total) => round((float) $total, 2))
                ->all(),
        ];
    }

    /**
     * @return Collection<int, ExpenseCategory>
     */
    protected function activeCategories()
    {
        return ExpenseCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'description']);
    }

    public function store(StoreExpenseRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = collect($request->validated())->except(['receipt'])->all();
        $companyId = TenantContext::requireCompanyIdForWrite($user);
        $data['company_id'] = $companyId;
        $data['created_by'] = $user->id;

        $expense = Expense::create($data);
        $this->attachReceipt($request, $expense, $companyId);

        return redirect()->route('expenses.index')->with('success', 'Gasto registrado.');
    }

    /**
     * Captura rapida de movil: foto, monto y categoria. La descripcion se completa luego.
     *
     * El comprobante sigue siendo obligatorio —es el dato que no se puede reconstruir
     * despues—; lo demas queda marcado para completar.
     */
    public function quickStore(QuickStoreExpenseRequest $request): RedirectResponse
    {
        $this->authorize('create', Expense::class);

        $user = $request->user();
        $companyId = TenantContext::requireCompanyIdForWrite($user);
        $category = ExpenseCategory::query()->findOrFail($request->integer('category_id'));

        $expense = Expense::create([
            'company_id' => $companyId,
            'category_id' => $category->id,
            'amount' => $request->input('amount'),
            'description' => "{$category->name} · captura rápida",
            'expense_date' => now()->toDateString(),
            'needs_detail' => true,
            'created_by' => $user->id,
        ]);

        $this->attachReceipt($request, $expense, $companyId);

        return redirect()->route('expenses.index')->with('success', 'Gasto capturado. Completa la descripción cuando puedas.');
    }

    protected function attachReceipt(Request $request, Expense $expense, int $companyId): void
    {
        if (! $request->hasFile('receipt')) {
            return;
        }

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

    public function show(Expense $expense): Response
    {
        $expense->load(['category:id,name', 'creator:id,name,last_name,email', 'company:id,name']);

        return Inertia::render('Expenses/Show', [
            'expense' => $this->toExpenseDetail($expense),
        ]);
    }

    public function edit(Expense $expense): Response
    {
        $categories = ExpenseCategory::query()
            ->where(function ($q) use ($expense) {
                $q->where('is_active', true)->orWhere('id', $expense->category_id);
            })
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'is_active']);

        $expense->load(['category:id,name', 'creator:id,name,last_name,email', 'company:id,name']);

        return Inertia::render('Expenses/Edit', [
            'expense' => $this->toExpenseDetail($expense),
            'categories' => $categories,
            'monthContext' => $this->monthContext($expense->id),
        ]);
    }

    public function update(UpdateExpenseRequest $request, Expense $expense): RedirectResponse
    {
        $data = collect($request->validated())->except(['receipt'])->all();
        // Al pasar por el formulario completo el gasto deja de estar «por completar».
        $data['needs_detail'] = false;
        $expense->update($data);

        if ($request->hasFile('receipt')) {
            $this->storedFileDeleter->deleteIfPresent($expense->receipt_path);
            $this->attachReceipt($request, $expense, (int) $expense->company_id);
        }

        return redirect()->route('expenses.index')->with('success', 'Gasto actualizado.');
    }

    public function destroy(Expense $expense): RedirectResponse
    {
        $expense->delete();

        return redirect()->route('expenses.index')->with('success', 'Gasto archivado.');
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
            'needs_detail' => (bool) $expense->needs_detail,
            'notes' => $expense->notes,
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
        return array_merge($this->toExpenseRow($expense), [
            'notes' => $expense->notes,
            'receipt_original_name' => $expense->receipt_original_name,
            'updated_at' => $expense->updated_at?->toIso8601String(),
            'creator' => $expense->creator ? [
                'id' => $expense->creator->id,
                'full_name' => trim(($expense->creator->name ?? '').' '.($expense->creator->last_name ?? '')),
                'email' => $expense->creator->email,
            ] : null,
        ]);
    }
}
