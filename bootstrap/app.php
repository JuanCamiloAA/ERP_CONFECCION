<?php

use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\ForcePasswordChange;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'permission' => CheckPermission::class,
            'company' => EnsureUserBelongsToCompany::class,
            'super.admin' => EnsureSuperAdmin::class,
            'force.password' => ForcePasswordChange::class,
            'role' => RoleMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function (Response $response, Throwable $exception, $request) {
            if (! app()->environment(['local', 'testing']) && in_array($response->getStatusCode(), [500, 503, 404, 403])) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => $exception->getMessage() ?: 'Error del servidor',
                    ], $response->getStatusCode());
                }

                return inertia('Errors/Error', [
                    'status' => $response->getStatusCode(),
                    'message' => $exception->getMessage(),
                ])->toResponse($request)->setStatusCode($response->getStatusCode());
            }

            if ($response->getStatusCode() === 419) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => 'La pagina expiro, intenta nuevamente. Recarga el editor y prueba otra vez.',
                    ], 419);
                }

                return back()->with([
                    'error' => 'La pagina expiro, intenta nuevamente.',
                ]);
            }

            return $response;
        });
    })->create();
