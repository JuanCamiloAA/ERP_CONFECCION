<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Company\StoreCompanyRequest;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Models\Company;
use App\Models\MembershipPlan;
use App\Services\CompanyDefaultRolesService;
use App\Services\Files\StoredFileDeleter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = Company::query()
            ->with(['membershipPlan:id,name,max_staff_users'])
            ->withCount([
                'users as staff_users_count' => fn ($q) => $q->whereNull('employee_id'),
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nit', 'like', "%{$search}%");
            });
        }

        $companies = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Companies/Index', [
            'companies' => $companies,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Companies/Create', [
            'membershipPlans' => MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'max_staff_users', 'max_employees']),
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
        ]);

        return Inertia::render('Companies/Edit', [
            'company' => $company,
            'membershipPlans' => MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'max_staff_users', 'max_employees']),
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
