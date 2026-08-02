<?php

namespace App\Http\Controllers;

use App\Models\DashboardWidget;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use App\Services\DashboardBuilder\WidgetQueryException;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardWidgetDataController extends Controller
{
    public function __construct(protected WidgetQueryBuilder $queryBuilder) {}

    public function show(Request $request, DashboardWidget $widget): JsonResponse
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        if (! $user || ! $widget->isVisibleFor($user, $companyId)) {
            abort(403, 'No autorizado.');
        }

        $sessionVariables = [
            'current_user_id' => $user->id,
            'current_employee_id' => $user->employee_id,
            'current_company_id' => $companyId,
        ];

        // Se incluye el usuario en la clave de cache: si el widget usa variables de sesion
        // (ej. "empleado actual"), el resultado varia por persona aunque sean de la misma empresa.
        $cacheKey = "dashboard_widget:{$widget->id}:company:{$companyId}:user:{$user->id}";

        try {
            $data = Cache::remember(
                $cacheKey,
                max(15, (int) $widget->refresh_interval_seconds),
                fn () => $this->queryBuilder->execute($widget, $companyId, $sessionVariables)
            );
        } catch (WidgetQueryException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'No se pudo cargar este widget.'], 500);
        }

        return response()->json([
            'type' => $widget->type,
            'title' => $widget->title,
            'chart_config' => $widget->chart_config,
            'data' => $data,
        ]);
    }
}
