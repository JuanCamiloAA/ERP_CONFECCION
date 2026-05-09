<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ActiveCompanyController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        ]);

        $id = $data['company_id'] ?? null;

        if ($id !== null) {
            $company = Company::query()->whereKey($id)->where('is_active', true)->first();
            if (! $company) {
                throw ValidationException::withMessages([
                    'company_id' => ['La empresa no esta disponible.'],
                ]);
            }
            session([TenantContext::SESSION_KEY => (int) $id]);
        } else {
            session()->forget(TenantContext::SESSION_KEY);
        }

        session()->forget(TenantContext::LEGACY_SESSION_KEY);

        return $id !== null
            ? back()->with('success', 'Empresa activa actualizada.')
            : back()->with('success', 'Vista consolidada: todas las empresas.');
    }
}
