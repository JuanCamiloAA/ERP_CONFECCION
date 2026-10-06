<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserBelongsToCompany
{
    /**
     * Rutas que siguen abiertas con la membresia suspendida: «Mi empresa» (donde se paga),
     * lo de la tarjeta y la renovacion, y cambiar la contrasena. Las que terminan en punto
     * cubren todo lo que empiece asi.
     */
    public const SUSPENDED_ALLOWED = [
        'settings.index',
        'settings.membership.',
        'settings.payment-method.update',
        'settings.auto-debit.toggle',
        'profile.change-password.show',
        'profile.change-password',
    ];

    /**
     * Exige empresa activa segun el maestro. Con la membresia suspendida deja entrar, pero
     * solo a pagar: cerrar la puerta del todo dejaba a la empresa sin forma de renovar.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        if (! $user->company_id) {
            auth()->logout();

            return redirect()->route('login')->with('error', 'Tu cuenta no esta asociada a ninguna empresa.');
        }

        $company = Company::query()->find($user->company_id);

        if (! $company) {
            auth()->logout();

            return redirect()->route('login')->with('error', 'Tu empresa ya no existe o fue eliminada. Contacta al soporte.');
        }

        $blockMessage = $company->corporateAuthenticationBlockReason();
        if ($blockMessage !== null) {
            auth()->logout();

            return redirect()->to(route('login').'?company='.$user->company_id)
                ->with('error', $blockMessage);
        }

        // La empresa ya esta leida: se cuelga del usuario para que el resto de la peticion
        // (HandleInertiaRequests, controladores) no la vuelva a consultar.
        $user->setRelation('company', $company);

        if ($company->isSuspended() && ! $this->allowedWhileSuspended($request)) {
            return $this->suspendedResponse($request, $company, $user);
        }

        return $next($request);
    }

    protected function allowedWhileSuspended(Request $request): bool
    {
        $name = (string) $request->route()?->getName();

        foreach (self::SUSPENDED_ALLOWED as $allowed) {
            if ($name === $allowed || (str_ends_with($allowed, '.') && str_starts_with($name, $allowed))) {
                return true;
            }
        }

        return false;
    }

    protected function suspendedResponse(Request $request, Company $company, $user): Response
    {
        $message = 'La membresía de la empresa está suspendida. Pagarla reactiva todo lo demás.';

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message], 402);
        }

        // Quien no puede ver «Mi empresa» no tiene adonde ir: se le explica a quien acudir.
        if (! $user->can('settings.index.view')) {
            return Inertia::render('Errors/Suspended', ['company' => $company->name])
                ->toResponse($request)
                ->setStatusCode(402);
        }

        return redirect()->to(route('settings.index').'#membresia')->with('warning', $message);
    }
}
