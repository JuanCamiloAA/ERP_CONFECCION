<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AccessLog;
use App\Models\Company;
use App\Services\Files\MediaUrlResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(Request $request): Response
    {
        $loginCompany = $this->resolveLoginCompany($request);

        return Inertia::render('Auth/Login', [
            'loginCompany' => $loginCompany,
        ]);
    }

    /**
     * @return array{id: int, name: string, logo_url: string|null}|null
     */
    protected function resolveLoginCompany(Request $request): ?array
    {
        $raw = $request->query('company') ?? $request->query('empresa');
        if ($raw === null || $raw === '') {
            return null;
        }

        if (! is_numeric($raw)) {
            return null;
        }

        $company = Company::query()->where('id', (int) $raw)->first();

        if (! $company || $company->corporateAuthenticationBlockReason() !== null) {
            return null;
        }

        return [
            'id' => $company->id,
            'name' => $company->name,
            'logo_url' => app(MediaUrlResolver::class)->url($company->getAttributes()['logo'] ?? null),
        ];
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();
        $request->session()->regenerate();

        AccessLog::log('login', Auth::id());

        return redirect()->intended(route('dashboard', absolute: false));
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $userId = Auth::id();
        $companyId = $user && ! $user->isSuperAdmin() ? $user->company_id : null;

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        AccessLog::log('logout', $userId);

        if ($companyId) {
            return redirect()->to(route('login').'?company='.$companyId);
        }

        return redirect('/');
    }
}
