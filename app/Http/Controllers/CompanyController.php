<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Company\StoreCompanyRequest;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Models\Company;
use App\Models\MembershipPlan;
use App\Models\Scopes\CompanyScope;
use App\Services\CompanyDefaultRolesService;
use App\Services\Files\StoredFileDeleter;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use League\Csv\Bom;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CompanyController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    /** Dias antes del vencimiento a partir de los cuales una membresia «esta por vencer». */
    protected const EXPIRING_WINDOW_DAYS = 45;

    /** Porcentaje del limite de staff a partir del cual la empresa «esta al limite». */
    protected const AT_LIMIT_RATIO = 0.9;

    /** Ordenaciones que acepta el listado, con la etiqueta que ve el usuario. */
    protected const SORTS = [
        'name' => 'Nombre',
        'staff_usage' => 'Uso de staff',
        'employees' => 'Empleados',
        'expiring' => 'Vencimiento',
    ];

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['all', 'active', 'inactive', 'at_limit', 'expiring'], true)) {
            $status = 'all';
        }

        $plan = $request->input('plan');
        $plan = is_string($plan) && $plan !== '' ? $plan : null;

        $sort = (string) $request->input('sort', 'name');
        if (! array_key_exists($sort, self::SORTS)) {
            $sort = 'name';
        }

        $direction = $request->input('direction') === 'desc' ? 'desc' : 'asc';

        $query = $this->companyBaseQuery();
        $this->applyIndexFilters($query, $search, $status, $plan);
        $this->applySort($query, $sort, $direction);

        $companies = $query->paginate(15)->withQueryString();

        return Inertia::render('Companies/Index', [
            'companies' => $companies,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'plan' => $plan,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'sorts' => collect(self::SORTS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'stats' => $this->indexStats(),
            'summary' => $this->indexSummary(),
            'chipCounts' => $this->chipCounts($search, $plan),
            'plans' => MembershipPlan::query()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug']),
        ]);
    }

    /**
     * Ordena el listado.
     *
     * «Uso de staff» ordena por la proporcion usado/tope, no por el numero suelto: una
     * empresa con 4 de 5 esta mas apretada que una con 30 de 100, y es la primera la que hay
     * que mirar. Sin tope no hay proporcion, asi que esas quedan al final.
     */
    protected function applySort(Builder $query, string $sort, string $direction): void
    {
        $dir = $direction === 'desc' ? 'desc' : 'asc';

        match ($sort) {
            'staff_usage' => $query->orderByRaw(
                '(select count(*) from users where users.company_id = companies.id and users.employee_id is null and users.deleted_at is null) '
                .'/ nullif((select max_staff_users from membership_plans where membership_plans.id = companies.membership_plan_id), 0) '
                .$dir.' , companies.name asc'
            ),
            'employees' => $query->orderByRaw(
                '(select count(*) from employees where employees.company_id = companies.id and employees.deleted_at is null) '
                .$dir.' , companies.name asc'
            ),
            'expiring' => $query->orderByRaw('companies.membership_ends_at is null asc')
                ->orderBy('companies.membership_ends_at', $dir)
                ->orderBy('companies.name'),
            default => $query->orderBy('companies.name', $dir),
        };
    }

    /**
     * Exporta el listado con los filtros puestos.
     *
     * Exporta lo filtrado y no la tabla entera: quien acaba de acotar «por vencer» espera
     * llevarse esas y no las trescientas.
     */
    public function export(Request $request): StreamedResponse
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('status', 'all');
        $plan = $request->input('plan');
        $plan = is_string($plan) && $plan !== '' ? $plan : null;

        $query = $this->companyBaseQuery();
        $this->applyIndexFilters($query, $search, $status, $plan);

        $filename = 'empresas-'.now()->format('Ymd-Hi').'.csv';

        return response()->streamDownload(function () use ($query) {
            $writer = Writer::createFromStream(fopen('php://output', 'w'));
            $writer->setOutputBOM(Bom::Utf8);
            $writer->insertOne([
                'Empresa', 'NIT', 'Correo', 'Telefono', 'Direccion', 'Plan',
                'Usuarios staff', 'Limite staff', 'Empleados', 'Limite empleados',
                'Inicio membresia', 'Fin membresia', 'Estado',
            ]);

            $query->orderBy('name')->chunk(500, function ($rows) use ($writer) {
                foreach ($rows as $company) {
                    $writer->insertOne([
                        $company->name,
                        $company->nit,
                        $company->email,
                        $company->phone,
                        $company->address,
                        $company->membershipPlan?->name ?? 'Sin plan',
                        $company->staff_users_count,
                        $company->membershipPlan?->max_staff_users ?? 'Ilimitado',
                        $company->employees_count,
                        $company->membershipPlan?->max_employees ?? 'Ilimitado',
                        $company->membership_started_at?->format('Y-m-d'),
                        $company->membership_ends_at?->format('Y-m-d'),
                        $company->is_active ? 'Activa' : 'Inactiva',
                    ]);
                }
            });
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Consulta base del listado, con los conteos que la pantalla necesita para las barras de
     * uso. Se comparte con los conteos de los chips para que filtro y contador no discrepen.
     */
    protected function companyBaseQuery(): Builder
    {
        return Company::query()
            ->with(['membershipPlan:id,name,slug,max_staff_users,max_employees'])
            ->withCount([
                'users as staff_users_count' => fn ($q) => $q->whereNull('employee_id'),
                // Employee lleva CompanyScope: sin quitarlo, la subconsulta se filtraria por la
                // empresa que el super admin tenga seleccionada y todas las filas mostrarian
                // el mismo numero. SoftDeletes se conserva.
                'employees as employees_count' => fn ($q) => $q->withoutGlobalScope(CompanyScope::class),
            ]);
    }

    protected function applyIndexFilters(Builder $query, string $search, string $status, ?string $plan): void
    {
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nit', 'like', "%{$search}%");
            });
        }

        if ($plan !== null) {
            $query->whereHas('membershipPlan', fn ($q) => $q->where('slug', $plan));
        }

        match ($status) {
            'active' => $query->where('is_active', true),
            'inactive' => $query->where('is_active', false),
            // «Al limite» compara el staff usado contra el tope del plan; sin plan o sin tope
            // no hay limite que rozar, asi que esas empresas quedan fuera.
            'at_limit' => $query->whereHas('membershipPlan', fn ($q) => $q->whereNotNull('max_staff_users'))
                ->whereRaw(
                    '(select count(*) from users where users.company_id = companies.id and users.employee_id is null and users.deleted_at is null) >= '
                    .'(select max_staff_users * ? from membership_plans where membership_plans.id = companies.membership_plan_id)',
                    [self::AT_LIMIT_RATIO]
                ),
            'expiring' => $query->whereNotNull('membership_ends_at')
                ->whereDate('membership_ends_at', '<=', now()->addDays(self::EXPIRING_WINDOW_DAYS)),
            default => null,
        };
    }

    /**
     * Las cuatro cifras de la franja. Se calculan sobre todas las empresas, nunca sobre la
     * pagina: una metrica que cambia al pasar de pagina no sirve para decidir nada.
     *
     * @return list<array<string, mixed>>
     */
    protected function indexStats(): array
    {
        $companies = $this->companyBaseQuery()->get();

        $active = $companies->where('is_active', true)->count();
        $lastDeactivated = $companies->where('is_active', false)->sortByDesc('updated_at')->first();

        $staffUsed = $companies->sum('staff_users_count');
        $staffLimit = $companies->sum(fn (Company $c) => (int) ($c->membershipPlan->max_staff_users ?? 0));

        $atLimit = $companies->filter(function (Company $c) {
            $max = $c->membershipPlan->max_staff_users ?? null;

            return $max !== null && $max > 0 && $c->staff_users_count >= $max * self::AT_LIMIT_RATIO;
        })->count();

        $expiring = $companies->filter(fn (Company $c) => $c->membership_ends_at !== null
            && $c->membership_ends_at->lte(now()->addDays(self::EXPIRING_WINDOW_DAYS)))->count();

        return [
            [
                'label' => 'Empresas activas',
                'value' => $active.' / '.$companies->count(),
                'note' => $lastDeactivated
                    ? 'Última desactivada: '.$lastDeactivated->name
                    : 'Ninguna desactivada',
            ],
            [
                'label' => 'Empleados totales',
                'value' => (string) $companies->sum('employees_count'),
                'note' => $companies->count().' empresas',
            ],
            [
                'label' => 'Usuarios staff',
                'value' => $staffUsed.' / '.($staffLimit > 0 ? $staffLimit : '∞'),
                'note' => $atLimit === 1
                    ? '1 empresa al 90 % del límite'
                    : $atLimit.' empresas al 90 % del límite',
            ],
            [
                'label' => 'Membresías por vencer',
                'value' => (string) $expiring,
                'note' => 'en los próximos '.self::EXPIRING_WINDOW_DAYS.' días',
                'tone' => $expiring > 0 ? 'warning' : 'default',
            ],
        ];
    }

    /**
     * Cifras sueltas para la descripcion de la cabecera. Se calculan aparte de `indexStats`
     * porque alli van ya formateadas como texto y aqui hacen falta como numeros.
     *
     * @return array<string, int|null>
     */
    protected function indexSummary(): array
    {
        $companies = $this->companyBaseQuery()->get();
        $limits = $companies->map(fn (Company $c) => $c->membershipPlan->max_staff_users ?? null);

        return [
            'total' => $companies->count(),
            'active' => $companies->where('is_active', true)->count(),
            'staff_used' => (int) $companies->sum('staff_users_count'),
            // Un solo plan sin tope hace que el total del sistema tampoco tenga tope.
            'staff_limit' => $limits->contains(null) ? null : (int) $limits->sum(),
        ];
    }

    /**
     * Conteo de cada chip con el resto de filtros puestos: pulsar uno que devuelve cero es
     * el camino mas rapido a una pantalla vacia sin explicacion.
     *
     * @return array<string, int>
     */
    protected function chipCounts(string $search, ?string $plan): array
    {
        $counts = [];

        foreach (['all', 'active', 'inactive', 'at_limit', 'expiring'] as $status) {
            $query = Company::query();
            $this->applyIndexFilters($query, $search, $status, $plan);
            $counts[$status] = $query->count();
        }

        return $counts;
    }

    public function create(): Response
    {
        return Inertia::render('Companies/Create', [
            'membershipPlans' => MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'max_staff_users', 'max_employees', 'price_monthly']),
        ]);
    }

    public function store(StoreCompanyRequest $request): RedirectResponse
    {
        $data = collect($request->validated())->except(['logo'])->all();
        $data['logo'] = null;
        $data['is_active'] = $data['is_active'] ?? true;

        if (empty($data['membership_plan_id'])) {
            $data['membership_plan_id'] = MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->value('id');
        }

        $company = Company::create($data);

        if ($request->hasFile('logo')) {
            $uploaded = $this->objectStorage->upload(
                $request->file('logo'),
                "companies/{$company->id}/logo"
            );
            $company->update(['logo' => $uploaded['path']]);
        }

        app(CompanyDefaultRolesService::class)->ensureDefaultRolesForCompany($company);

        return redirect()->route('companies.index')->with('success', 'Empresa creada.');
    }

    public function edit(Company $company): Response
    {
        $company->loadMissing(['membershipPlan:id,name,max_staff_users,max_employees']);
        $company->loadCount([
            'users as staff_users_count' => fn ($q) => $q->whereNull('employee_id'),
            // Sin quitar CompanyScope contaria los empleados de la empresa seleccionada, no
            // los de la que se esta editando.
            'employees as employees_count' => fn ($q) => $q->withoutGlobalScope(CompanyScope::class),
        ]);

        return Inertia::render('Companies/Edit', [
            'company' => $company,
            'membershipPlans' => MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'max_staff_users', 'max_employees', 'price_monthly']),
        ]);
    }

    public function update(UpdateCompanyRequest $request, Company $company): RedirectResponse
    {
        $data = $request->validated();
        unset($data['logo']);

        if ($request->hasFile('logo')) {
            $this->storedFileDeleter->deleteIfPresent($company->getAttributes()['logo'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('logo'),
                "companies/{$company->id}/logo"
            );
            $data['logo'] = $uploaded['path'];
        }

        $company->update($data);

        return redirect()->route('companies.index')->with('success', 'Empresa actualizada.');
    }

    public function destroy(Company $company): RedirectResponse
    {
        $company->is_active = false;
        $company->save();
        $company->delete();

        return redirect()->route('companies.index')->with('success', 'Empresa desactivada.');
    }

    public function setActive(Request $request): RedirectResponse
    {
        $request->validate([
            'company_id' => ['required', 'integer', 'exists:companies,id'],
        ]);

        if (! $request->user()->isSuperAdmin()) {
            abort(403);
        }

        $company = Company::query()
            ->whereKey($request->input('company_id'))
            ->where('is_active', true)
            ->first();
        if (! $company) {
            return back()->with('error', 'La empresa no esta disponible.');
        }

        session([TenantContext::SESSION_KEY => $company->id]);
        session()->forget(TenantContext::LEGACY_SESSION_KEY);

        return back()->with('success', 'Empresa activa cambiada.');
    }
}
