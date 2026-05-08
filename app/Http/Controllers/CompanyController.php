<?php

namespace App\Http\Controllers;

use App\Http\Requests\Company\StoreCompanyRequest;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Models\Company;
use App\Services\CompanyDefaultRolesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = Company::query()->withCount(['employees', 'users']);

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
        return Inertia::render('Companies/Create');
    }

    public function store(StoreCompanyRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('logo')) {
            $data['logo'] = $request->file('logo')->store('companies', 'public');
        }

        $data['is_active'] = $data['is_active'] ?? true;

        $company = Company::create($data);

        app(CompanyDefaultRolesService::class)->ensureDefaultRolesForCompany($company);

        return redirect()->route('companies.index')->with('success', 'Empresa creada.');
    }

    public function edit(Company $company): Response
    {
        return Inertia::render('Companies/Edit', [
            'company' => $company,
        ]);
    }

    public function update(UpdateCompanyRequest $request, Company $company): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('logo')) {
            $data['logo'] = $request->file('logo')->store('companies', 'public');
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

        session(['active_company_id' => $request->input('company_id')]);

        return back()->with('success', 'Empresa activa cambiada.');
    }
}
