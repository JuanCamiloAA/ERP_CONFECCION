<?php

namespace App\Http\Middleware;

use App\Models\AccessLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        if (! $user->is_active) {
            auth()->logout();
            return redirect()->route('login')->with('error', 'Tu cuenta esta desactivada. Contacta al administrador.');
        }

        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        if (! $user->can($permission)) {
            AccessLog::log('permission_denied', $user->id, [
                'permission_checked' => $permission,
                'result' => 'denied',
            ]);

            if ($request->expectsJson()) {
                abort(403, "No tienes permiso para: {$permission}");
            }

            return inertia('Errors/403', [
                'permission' => $permission,
                'message' => 'No tienes permiso para acceder a esta pagina.',
            ])->toResponse($request)->setStatusCode(403);
        }

        return $next($request);
    }
}
