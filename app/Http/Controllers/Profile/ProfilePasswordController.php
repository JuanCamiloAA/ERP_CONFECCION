<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Services\Account\SessionInspector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Cambio de contraseña desde «Mi perfil».
 *
 * Además de guardarla, hace dos cosas que la pantalla promete: sella
 * `password_changed_at` —de ahí sale la antigüedad que se muestra, que antes era un texto
 * fijo— y cierra las demás sesiones. Lo segundo importa: si alguien cambia la contraseña
 * porque sospecha, dejar abiertas las sesiones del intruso convierte el cambio en un gesto
 * vacío.
 */
class ProfilePasswordController extends Controller
{
    public function __construct(protected SessionInspector $sessions) {}

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], [
            'current_password.required' => 'Escribe tu contraseña actual.',
            'password.required' => 'Escribe la contraseña nueva.',
            'password.confirmed' => 'La confirmación no coincide.',
            'password.min' => 'Debe tener al menos 8 caracteres.',
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'La contraseña actual no es correcta.',
            ]);
        }

        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'La contraseña nueva debe ser distinta de la actual.',
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'password_changed_at' => now(),
            'password_change_required' => false,
        ])->save();

        // La sesión propia se renueva para que el cambio no la invalide de rebote.
        $request->session()->regenerate();
        Auth::setUser($user);

        $closed = $this->sessions->destroyOthers($user, $request->session()->getId());

        AccessLog::log('profile_password_changed', $user->id);

        $message = 'Contraseña actualizada.';
        if ($closed > 0) {
            $message .= ' Se cerraron '.$closed.' sesión(es) abiertas en otros dispositivos.';
        }

        return back()->with('success', $message);
    }
}
