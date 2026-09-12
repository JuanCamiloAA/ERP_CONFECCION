<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Services\Account\SessionInspector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Cierre de las demás sesiones.
 *
 * Borra las filas de `sessions` de la cuenta salvo la actual: sin fila de sesión el
 * siguiente clic de ese navegador ya no está autenticado. Pide la contraseña porque es una
 * acción que expulsa a alguien —posiblemente a un intruso, posiblemente a uno mismo desde
 * otro equipo— y no debe poder dispararse desde una sesión que quedó abierta sin vigilar.
 */
class ProfileSessionController extends Controller
{
    public function __construct(protected SessionInspector $sessions) {}

    public function destroyOthers(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $this->sessions->isSupported()) {
            return back()->with('error', 'Las sesiones no se pueden listar ni cerrar con la configuración actual del servidor.');
        }

        $request->validate([
            'current_password' => ['required', 'string'],
        ], [
            'current_password.required' => 'Confirma tu contraseña.',
        ]);

        if (! Hash::check((string) $request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'La contraseña no es correcta.',
            ]);
        }

        $closed = $this->sessions->destroyOthers($user, $request->session()->getId());

        AccessLog::log('sessions_revoked', $user->id);

        return back()->with(
            'success',
            $closed > 0
                ? 'Se cerraron '.$closed.' sesión(es). Solo sigue abierta la de este dispositivo.'
                : 'No había otras sesiones abiertas.',
        );
    }
}
