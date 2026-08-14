<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardLayoutController extends Controller
{
    public const VARIANTS = ['super_admin_consolidated', 'super_admin_focused', 'company_admin', 'employee'];

    /** Sufijo del layout movil: se guarda aparte para no pisar el de escritorio del mismo usuario. */
    public const MOBILE_SUFFIX = ':mobile';

    /**
     * Variantes aceptadas: las de escritorio y su equivalente movil ("company_admin:mobile", etc.).
     *
     * @return list<string>
     */
    public static function allowedVariants(): array
    {
        return array_merge(
            self::VARIANTS,
            array_map(fn (string $v): string => $v.self::MOBILE_SUFFIX, self::VARIANTS),
        );
    }

    /**
     * Guarda la posicion y tamano de los paneles del dashboard del usuario autenticado
     * (preferencia personal, no afecta a otros usuarios aunque compartan empresa y rol).
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'variant' => ['required', 'string', 'in:'.implode(',', self::allowedVariants())],
            'layout' => ['required', 'array'],
            'layout.*.i' => ['required', 'string', 'max:80'],
            'layout.*.x' => ['required', 'integer', 'min:0'],
            'layout.*.y' => ['required', 'integer', 'min:0'],
            'layout.*.w' => ['required', 'integer', 'min:1'],
            // min:0 (no min:1) porque el layout movil codifica "panel oculto" como h = 0.
            'layout.*.h' => ['required', 'integer', 'min:0'],
        ]);

        $user = $request->user();
        $layout = (array) $user->dashboard_layout;
        $layout[$data['variant']] = array_values($data['layout']);
        $user->dashboard_layout = $layout;
        $user->save();

        return response()->json(['success' => true]);
    }
}
