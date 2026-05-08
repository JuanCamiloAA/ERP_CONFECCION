<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserBelongsToCompany
{
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

        if ($user->company && ! $user->company->is_active) {
            auth()->logout();

            return redirect()->to(route('login').'?company='.$user->company_id)
                ->with('error', 'Tu empresa esta desactivada. Contacta al soporte.');
        }

        return $next($request);
    }
}
