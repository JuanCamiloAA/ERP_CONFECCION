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

        /*
         * Verificacion en dos pasos.
         *
         * Se intercepta DESPUES de `authenticate()`, no dentro: alli ya se comprobaron
         * credenciales, cuenta activa, empresa existente y bloqueos de la empresa, y
         * repetir eso aqui seria duplicar reglas que tienen que decidir igual.
         *
         * Se cierra la sesion autenticada y se deja solo el id pendiente: hasta que el
         * codigo se valide, este navegador no tiene acceso a nada. La sesion se regenera
         * igualmente para no arrastrar el identificador previo al login.
         */
        $user = Auth::user();

        if ($user && $user->hasTwoFactorEnabled()) {
            $remember = $request->boolean('remember');

            Auth::guard('web')->logout();
            $request->session()->regenerate();
            $request->session()->put(TwoFactorChallengeController::SESSION_USER, $user->id);
            $request->session()->put(TwoFactorChallengeController::SESSION_REMEMBER, $remember);

            AccessLog::log('login_two_factor_challenged', $user->id);

            return redirect()->route('two-factor.challenge');
        }

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
