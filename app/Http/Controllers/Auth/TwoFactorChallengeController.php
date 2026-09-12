<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\User;
use App\Services\Account\TwoFactorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Segundo paso del inicio de sesión.
 *
 * Se llega aquí solo cuando las credenciales YA fueron validadas y todas las
 * comprobaciones de cuenta y empresa pasaron (ver `AuthenticatedSessionController@store`).
 * Entre ese punto y este la sesión NO está autenticada: lo único que queda en ella es el
 * id del usuario pendiente, así que un navegador que se detenga en esta pantalla no tiene
 * acceso a nada.
 *
 * El reintento va limitado aparte del login: un código de 6 dígitos se agota por fuerza
 * bruta en poco tiempo si se puede probar sin freno.
 */
class TwoFactorChallengeController extends Controller
{
    /** Claves de la sesión intermedia. Fuera de aquí nadie debe tocarlas. */
    public const SESSION_USER = 'auth.two_factor.user_id';

    public const SESSION_REMEMBER = 'auth.two_factor.remember';

    protected const MAX_ATTEMPTS = 5;

    public function __construct(protected TwoFactorService $twoFactor) {}

    public function create(Request $request): Response|RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/TwoFactorChallenge', [
            'recoveryCodesLeft' => count($this->twoFactor->recoveryCodes($user)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login')->with('error', 'La sesión de verificación caducó. Vuelve a iniciar sesión.');
        }

        $request->validate([
            'code' => ['required', 'string'],
        ], [
            'code.required' => 'Escribe el código de verificación.',
        ]);

        $key = $this->throttleKey($request, $user);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'code' => "Demasiados intentos. Espera {$seconds} segundos.",
            ]);
        }

        if (! $this->twoFactor->verify($user, (string) $request->input('code'))) {
            RateLimiter::hit($key, 300);

            throw ValidationException::withMessages([
                'code' => 'El código no es correcto. Revisa tu aplicación de autenticación o usa un código de respaldo.',
            ]);
        }

        RateLimiter::clear($key);

        $remember = (bool) $request->session()->pull(self::SESSION_REMEMBER, false);
        $request->session()->forget(self::SESSION_USER);

        Auth::login($user, $remember);
        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();

        AccessLog::log('login', $user->id);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /** Abandonar la verificación: limpia el estado intermedio y vuelve al login. */
    public function destroy(Request $request): RedirectResponse
    {
        $request->session()->forget([self::SESSION_USER, self::SESSION_REMEMBER]);

        return redirect()->route('login');
    }

    /**
     * Usuario a medio autenticar.
     *
     * Se vuelve a comprobar que siga activo y con 2FA: entre el primer paso y el segundo
     * pueden pasar minutos, y en ese hueco a la cuenta pudieron desactivarla.
     */
    protected function pendingUser(Request $request): ?User
    {
        $id = $request->session()->get(self::SESSION_USER);

        if (! $id) {
            return null;
        }

        $user = User::query()->find($id);

        if (! $user || ! $user->is_active || ! $user->hasTwoFactorEnabled()) {
            $request->session()->forget([self::SESSION_USER, self::SESSION_REMEMBER]);

            return null;
        }

        return $user;
    }

    protected function throttleKey(Request $request, User $user): string
    {
        return Str::lower('2fa|'.$user->id.'|'.$request->ip());
    }
}
