<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\User;
use App\Notifications\ConfirmEmailChangeNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Cambio del correo de inicio de sesión.
 *
 * En dos tiempos y nunca en uno: se guarda como `pending_email` y el correo vigente sigue
 * siendo el de antes hasta que se abre el enlace enviado a la dirección NUEVA. Eso es lo
 * que prueba que la bandeja existe y es de quien dice, y lo que evita que un dedazo deje a
 * alguien sin poder entrar a su propia cuenta.
 *
 * Pide la contraseña actual porque cambiar el correo es cambiar la llave de la cuenta: con
 * una sesión abierta sin vigilar, sin este paso bastaría un minuto para quedarse con ella.
 */
class ProfileEmailController extends Controller
{
    /** El enlace de confirmación caduca; un correo antiguo no debe seguir sirviendo. */
    protected const CONFIRMATION_MINUTES = 60;

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'email' => [
                'required',
                'email',
                'max:120',
                // Sin excluir los borrados: `users.email` tiene un índice único que sí los
                // cuenta, así que dejar pasar el correo de una cuenta eliminada aquí
                // acabaría en un error de base de datos al guardar, no en un aviso.
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'current_password' => ['required', 'string'],
        ], [
            'email.required' => 'Escribe el correo nuevo.',
            'email.email' => 'El correo no es válido.',
            'email.unique' => 'Ya hay una cuenta con ese correo.',
            'current_password.required' => 'Confirma tu contraseña actual.',
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'La contraseña actual no es correcta.',
            ]);
        }

        if (strcasecmp($data['email'], (string) $user->email) === 0) {
            throw ValidationException::withMessages([
                'email' => 'Ese ya es tu correo actual.',
            ]);
        }

        $user->forceFill([
            'pending_email' => $data['email'],
            'pending_email_requested_at' => now(),
        ])->save();

        // Se envía a la dirección NUEVA, no a la del usuario: el enlace existe justamente
        // para probar que esa bandeja es suya. `Notification::route` evita que Laravel
        // resuelva el destinatario desde `$user->email`, que es el correo viejo.
        Notification::route('mail', $data['email'])->notify(new ConfirmEmailChangeNotification(
            $this->confirmationUrl($user->id, $data['email']),
            $data['email'],
            (string) $user->name,
            self::CONFIRMATION_MINUTES,
        ));

        AccessLog::log('profile_email_change_requested', $user->id);

        return back()->with('success', 'Te enviamos un enlace a '.$data['email'].'. El correo actual sigue activo hasta que lo confirmes.');
    }

    /**
     * Confirmación desde el enlace firmado.
     *
     * La firma lleva dentro el correo propuesto y se contrasta con `pending_email`: así un
     * enlace viejo deja de servir en cuanto se pide otro cambio, sin guardar tokens aparte.
     */
    public function confirm(Request $request, int $user): RedirectResponse
    {
        $authenticated = $request->user();

        // El enlace se abre desde la bandeja nueva, que puede estar en otro navegador. Se
        // exige haber iniciado sesión como esa misma cuenta: la firma prueba que el enlace
        // es auténtico, no quién lo está abriendo.
        if (! $authenticated || $authenticated->id !== $user) {
            return redirect()
                ->route('login')
                ->with('warning', 'Inicia sesión con tu cuenta y vuelve a abrir el enlace para confirmar el correo.');
        }

        $proposed = (string) $request->query('email', '');

        if ($proposed === '' || $authenticated->pending_email === null
            || strcasecmp($proposed, (string) $authenticated->pending_email) !== 0) {
            return redirect()
                ->route('profile.edit')
                ->with('error', 'Este enlace ya no es válido. Solicita el cambio de correo otra vez.');
        }

        // Otra cuenta pudo tomar ese correo entre la solicitud y la confirmación.
        // `withTrashed`: el índice único de `users.email` cuenta también las cuentas
        // eliminadas, así que si una de ellas tiene ese correo el guardado fallaría.
        $taken = User::withTrashed()
            ->where('email', $proposed)
            ->whereKeyNot($authenticated->id)
            ->exists();

        if ($taken) {
            $authenticated->forceFill(['pending_email' => null, 'pending_email_requested_at' => null])->save();

            return redirect()
                ->route('profile.edit')
                ->with('error', 'Ya hay una cuenta con ese correo. El cambio no se aplicó.');
        }

        $previous = $authenticated->email;

        $authenticated->forceFill([
            'email' => $proposed,
            'email_verified_at' => now(),
            'pending_email' => null,
            'pending_email_requested_at' => null,
        ])->save();

        AccessLog::log('profile_email_changed', $authenticated->id, [
            'permission_checked' => $previous.' -> '.$proposed,
        ]);

        return redirect()->route('profile.edit')->with('success', 'Tu correo de acceso es ahora '.$proposed.'.');
    }

    /** Cancela un cambio pendiente sin esperar a que caduque. */
    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        $user->forceFill(['pending_email' => null, 'pending_email_requested_at' => null])->save();

        return back()->with('success', 'Cambio de correo cancelado.');
    }

    protected function confirmationUrl(int $userId, string $email): string
    {
        return URL::temporarySignedRoute(
            'profile.email.confirm',
            now()->addMinutes(self::CONFIRMATION_MINUTES),
            ['user' => $userId, 'email' => $email],
        );
    }
}
