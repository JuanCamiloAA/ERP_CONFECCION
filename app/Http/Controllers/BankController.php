<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Bank\StoreBankRequest;
use App\Http\Requests\Bank\UpdateBankRequest;
use App\Models\Bank;
use App\Models\Employee;
use App\Services\Files\StoredFileDeleter;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BankController extends Controller
{
    /** Ordenaciones que acepta el listado, con la etiqueta que ve el usuario. */
    protected const SORTS = [
        'name' => 'Nombre',
        'employees' => 'Empleados',
        'code' => 'Código',
    ];

    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['all', 'active', 'inactive', 'wallet', 'without_logo'], true)) {
            $status = 'all';
        }

        $sort = (string) $request->input('sort', 'name');
        if (! array_key_exists($sort, self::SORTS)) {
            $sort = 'name';
        }

        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        $query = Bank::query()->withCount('employees');
        $this->applyIndexFilters($query, $search, $status);

        // El orden por nombre es el catalogo; el resto son consultas («cual usa mas gente»,
        // «cual no tiene codigo»), y ahi lo util es empezar por arriba.
        match ($sort) {
            'employees' => $query->orderBy('employees_count', $direction)->orderBy('name'),
            'code' => $query->orderBy('code', $direction === 'desc' ? 'desc' : 'asc')->orderBy('name'),
            default => $query->orderBy('name', $direction === 'desc' ? 'desc' : 'asc'),
        };

        $banks = $query->paginate(15)->withQueryString();

        return Inertia::render('Banks/Index', [
            'banks' => $banks,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'sorts' => collect(self::SORTS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'stats' => $this->indexStats(),
            'chipCounts' => $this->chipCounts($search),
        ]);
    }

    protected function applyIndexFilters(Builder $query, string $search, string $status): void
    {
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        match ($status) {
            'active' => $query->where('is_active', true),
            'inactive' => $query->where('is_active', false),
            'wallet' => $query->where('type', 'wallet'),
            'without_logo' => $query->whereNull('logo_path'),
            default => null,
        };
    }

    /**
     * Las tres cifras de la franja, sobre todo el catalogo y no sobre la pagina: una metrica
     * que cambia al pasar de pagina no sirve para decidir nada.
     *
     * @return list<array<string, mixed>>
     */
    protected function indexStats(): array
    {
        $banks = Bank::query()->get(['id', 'name', 'is_active', 'logo_path', 'updated_at']);

        $total = $banks->count();
        $active = $banks->where('is_active', true)->count();
        $withLogo = $banks->filter(fn (Bank $bank) => ! empty($bank->getAttributes()['logo_path']))->count();
        $lastInactive = $banks->where('is_active', false)->sortByDesc('updated_at')->first();

        $employeesTotal = Employee::query()->count();
        $employeesWithAccount = Employee::query()->whereNotNull('bank_id')->count();
        $withoutAccount = $employeesTotal - $employeesWithAccount;

        return [
            [
                'label' => 'Bancos activos',
                'value' => $active.' / '.$total,
                'note' => $lastInactive
                    ? 'Último inactivo: '.$lastInactive->name
                    : 'Ninguno inactivo',
            ],
            [
                'label' => 'Empleados con cuenta',
                'value' => $employeesWithAccount.' / '.$employeesTotal,
                'note' => $withoutAccount === 1
                    ? '1 sin datos de pago'
                    : $withoutAccount.' sin datos de pago',
            ],
            [
                'label' => 'Logos cargados',
                'value' => $withLogo.' / '.$total,
                'note' => 'Los demás usan monograma',
                // Avisa solo cuando faltan mas de la mitad: con uno suelto no hay nada que hacer.
                'tone' => $total > 0 && $withLogo * 2 < $total ? 'warning' : 'default',
            ],
        ];
    }

    /**
     * Conteo de cada chip con la busqueda puesta: pulsar un filtro que devuelve cero es el
     * camino mas rapido a una pantalla vacia sin explicacion.
     *
     * @return array<string, int>
     */
    protected function chipCounts(string $search): array
    {
        $counts = [];

        foreach (['all', 'active', 'wallet', 'without_logo'] as $status) {
            $query = Bank::query();
            $this->applyIndexFilters($query, $search, $status);
            $counts[$status] = $query->count();
        }

        return $counts;
    }

    public function create(): Response
    {
        return Inertia::render('Banks/Create', [
            'types' => $this->typeOptions(),
        ]);
    }

    public function store(StoreBankRequest $request): RedirectResponse
    {
        $data = collect($request->validated())->except(['logo', 'logo_remove'])->all();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $request->boolean('is_active', true);
        $data['requires_key'] = $request->boolean('requires_key', true);
        $data['logo_path'] = null;

        if ($request->hasFile('logo')) {
            $data['logo_path'] = $this->objectStorage->upload(
                $request->file('logo'),
                'banks/logos/'.$data['company_id']
            )['path'];
        }

        Bank::create($data);

        return redirect()->route('banks.index')->with('success', 'Banco creado.');
    }

    public function edit(Bank $bank): Response
    {
        $bank->loadCount('employees');

        return Inertia::render('Banks/Edit', [
            'bank' => $bank,
            'types' => $this->typeOptions(),
        ]);
    }

    public function update(UpdateBankRequest $request, Bank $bank): RedirectResponse
    {
        $data = collect($request->validated())->except(['logo', 'logo_remove'])->all();
        $data['is_active'] = $request->boolean('is_active', $bank->is_active);
        $data['requires_key'] = $request->boolean('requires_key', $bank->requires_key);

        // Se guarda la ruta cruda, no la URL resuelta que viaja al front.
        $currentPath = $bank->getAttributes()['logo_path'] ?? null;

        if ($request->hasFile('logo')) {
            $data['logo_path'] = $this->objectStorage->upload(
                $request->file('logo'),
                'banks/logos/'.$bank->company_id
            )['path'];

            // El anterior se borra despues de subir el nuevo: si la subida falla, el banco
            // se queda con el logo que ya tenia en vez de sin ninguno.
            $this->storedFileDeleter->deleteIfPresent($currentPath);
        } elseif ($request->boolean('logo_remove')) {
            $this->storedFileDeleter->deleteIfPresent($currentPath);
            $data['logo_path'] = null;
        }

        $bank->update($data);

        return redirect()->route('banks.index')->with('success', 'Banco actualizado.');
    }

    /**
     * Activa o desactiva desde el listado.
     *
     * Endpoint propio y no `update`: aquel exige `name` y `type`, y sobrescribiria la fila
     * entera con lo que tuviera la pantalla en memoria.
     */
    public function toggle(Request $request, Bank $bank): RedirectResponse
    {
        $active = $request->validate([
            'is_active' => ['required', 'boolean'],
        ])['is_active'];

        $bank->update(['is_active' => $active]);

        if ($active) {
            return back()->with('success', 'Banco activado.');
        }

        $inUse = $bank->employees()->count();

        return back()->with('success', $inUse === 0
            ? 'Banco desactivado.'
            : 'Banco desactivado. Los '.$inUse.' empleados con cuenta en él conservan sus datos de pago.');
    }

    /**
     * Si hay empleados con este banco, se desactiva en lugar de borrar para mantener histórico.
     * Sin empleados vinculados: soft delete normal.
     */
    public function destroy(Bank $bank): RedirectResponse
    {
        if ($bank->employees()->exists()) {
            if ($bank->is_active) {
                $bank->update(['is_active' => false]);

                return redirect()->route('banks.index')->with(
                    'success',
                    'Banco desactivado: hay empleados que lo usan. Sigue visible en sus registros aunque no aparezca en nuevos formularios.',
                );
            }

            return redirect()->route('banks.index')->with(
                'warning',
                'No se puede eliminar: hay empleados vinculados y el banco ya estaba inactivo.',
            );
        }

        // El logo deja de tener dueño: si no se borra aqui, queda huerfano en el disco.
        $this->storedFileDeleter->deleteIfPresent($bank->getAttributes()['logo_path'] ?? null);

        $bank->delete();

        return redirect()->route('banks.index')->with('success', 'Banco eliminado.');
    }

    /** @return list<array{value: string, label: string}> */
    protected function typeOptions(): array
    {
        return collect(Bank::TYPES)
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
            ->values()
            ->all();
    }
}
