<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as BaseResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Correo de recuperacion de contrasena con la plantilla de la aplicacion.
 *
 * Existe solo para eso: la notificacion de Laravel arma su cuerpo con las vistas
 * markdown del framework, que no comparten encabezado ni pie con el resto de los
 * correos. Aqui se cambia unicamente la vista; el token, la URL firmada y la
 * caducidad los sigue resolviendo la clase base.
 */
class ResetPasswordNotification extends BaseResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Recupera tu contrasena — '.config('branding.mail.brand'))
            ->view('emails.auth.reset-password', [
                'url' => $this->resetUrl($notifiable),
                'user' => $notifiable,
                'expiresInMinutes' => config('auth.passwords.'.config('auth.defaults.passwords').'.expire'),
            ]);
    }
}
