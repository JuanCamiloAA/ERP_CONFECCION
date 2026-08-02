<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardLayoutController extends Controller
{
    public const VARIANTS = ['super_admin_consolidated', 'super_admin_focused', 'company_admin', 'employee'];

    /**
     * Guarda la posicion y tamano de los paneles del dashboard del usuario autenticado
     * (preferencia personal, no afecta a otros usuarios aunque compartan empresa y rol).
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'variant' => ['required', 'string', 'in:'.implode(',', self::VARIANTS)],
            'layout' => ['required', 'array'],
            'layout.*.i' => ['required', 'string', 'max:80'],
            'layout.*.x' => ['required', 'integer', 'min:0'],
            'layout.*.y' => ['required', 'integer', 'min:0'],
            'layout.*.w' => ['required', 'integer', 'min:1'],
            'layout.*.h' => ['required', 'integer', 'min:1'],
        ]);

        $user = $request->user();
        $layout = (array) $user->dashboard_layout;
        $layout[$data['variant']] = array_values($data['layout']);
        $user->dashboard_layout = $layout;
        $user->save();

        return response()->json(['success' => true]);
    }
}
