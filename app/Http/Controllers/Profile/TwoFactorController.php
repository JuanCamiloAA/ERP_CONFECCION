<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Services\Account\TwoFactorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Verificación en dos pasos.
 *
 * El alta va en dos peticiones: `store` genera el secreto y devuelve el QR y los códigos de
 * respaldo UNA sola vez; `confirm` lo activa de verdad tras validar un código del
 * autenticador. Entre las dos la cuenta sigue entrando solo con contraseña, que es lo que
 * evita que un QR mal escaneado deje a alguien fuera.
 *
 * Los códigos de respaldo viajan al navegador solo en la respuesta de `store` y de
 * `recoveryCodes`, nunca en el payload de la pantalla: son equivalentes a contraseñas.
 */
class TwoFactorController extends Controller
{
    public function __construct(protected TwoFactorService $twoFactor) {}

    /** Genera el secreto y devuelve QR y códigos; todavía no activa nada. */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $this->assertPassword($request, $user);

        if ($user->hasTwoFactorEnabled()) {
            return back()->with('warning', 'La verificación en dos pasos ya está activa.');
        }

        $setup = $this->twoFactor->generateSecret($user);

        return back()->with([
            'success' => 'Escanea el código con tu aplicación de autenticación.',
            'two_factor_setup' => [
                'secret' => $setup['secret'],
                'qr' => $setup['qr'],
                'recovery_codes' => $setup['recovery_codes'],
            ],
        ]);
    }

    /** Activa la 2FA validando un código real del autenticador. */
    public function confirm(Request $request): RedirectResponse
    {
        $user = $request->user();

        $request->validate([
            'code' => ['required', 'string'],
        ], [
            'code.required' => 'Escribe el código de 6 dígitos.',
        ]);

        if ($user->two_factor_secret === null) {
            return back()->with('error', 'Vuelve a empezar la activación: no hay ningún código pendiente.');
        }

        if (! $this->twoFactor->confirm($user, (string) $request->input('code'))) {
            throw ValidationException::withMessages([
                'code' => 'El código no es correcto o ya caducó. Revisa la hora de tu teléfono e inténtalo otra vez.',
            ]);
        }

        AccessLog::log('two_factor_enabled', $user->id);

        return back()->with('success', 'Verificación en dos pasos activada.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        $this->assertPassword($request, $user);

        $this->twoFactor->disable($user);

        AccessLog::log('two_factor_disabled', $user->id);

        return back()->with('success', 'Verificación en dos pasos desactivada.');
    }

    /** Genera un juego nuevo de códigos de respaldo; los anteriores dejan de valer. */
    public function recoveryCodes(Request $request): RedirectResponse
    {
        $user = $request->user();

        $this->assertPassword($request, $user);

        if (! $user->hasTwoFactorEnabled()) {
            return back()->with('error', 'Activa primero la verificación en dos pasos.');
        }

        $codes = $this->twoFactor->regenerateRecoveryCodes($user);

        AccessLog::log('two_factor_recovery_codes_regenerated', $user->id);

        return back()->with([
            'success' => 'Códigos de respaldo nuevos. Guárdalos ahora: no se vuelven a mostrar.',
            'two_factor_recovery_codes' => $codes,
        ]);
    }

    /**
     * Reautenticación.
     *
     * Activar o quitar la 2FA cambia cómo se entra a la cuenta, así que exige la
     * contraseña aunque la sesión esté abierta: es la diferencia entre un despiste de un
     * minuto y perder el control de la cuenta.
     */
    protected function assertPassword(Request $request, $user): void
    {
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
    }
}
