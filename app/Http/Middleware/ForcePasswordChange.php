<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordChange
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->password_change_required) {
            return $next($request);
        }

        $allowedRoutes = [
            'profile.change-password.show',
            'profile.change-password',
            'logout',
        ];

        if (in_array($request->route()?->getName(), $allowedRoutes, true)) {
            return $next($request);
        }

        return redirect()->route('profile.change-password.show')
            ->with('warning', 'Debes cambiar tu contrasena temporal antes de continuar.');
    }
}
