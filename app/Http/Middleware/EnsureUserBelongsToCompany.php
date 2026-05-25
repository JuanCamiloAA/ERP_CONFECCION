<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserBelongsToCompany
{
    /**
     * Exige empresa activa según maestro y que no este vencido el limite configurado en membership_ends_at.
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

        return $next($request);
    }
}
