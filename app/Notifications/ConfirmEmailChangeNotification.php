<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Enlace para confirmar un correo nuevo.
 *
 * Va SIEMPRE a la dirección propuesta, nunca a la actual: es lo que prueba que esa bandeja
 * existe y es de quien la pide. Por eso se envía con `Notification::route()` y el nombre
 * del usuario llega por constructor —el destinatario aquí no es un modelo.
 */
class ConfirmEmailChangeNotification extends Notification
{
    public function __construct(
        protected string $url,
        protected string $newEmail,
        protected string $userName,
        protected int $expiresInMinutes,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirma tu correo nuevo — '.config('branding.mail.brand'))
            ->view('emails.auth.confirm-email-change', [
                'url' => $this->url,
                'newEmail' => $this->newEmail,
                'userName' => $this->userName,
                'expiresInMinutes' => $this->expiresInMinutes,
            ]);
    }
}
