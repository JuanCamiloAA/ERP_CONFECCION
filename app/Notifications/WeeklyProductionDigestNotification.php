<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/**
 * Resumen semanal de producción.
 *
 * Lo gobierna la preferencia `weekly_production_digest` y lo dispara el comando
 * `notifications:weekly-production-digest` desde el programador.
 *
 * @phpstan-type TopRow array{name: string, quantity: int, value: float}
 */
class WeeklyProductionDigestNotification extends Notification
{
    /**
     * @param  list<array{name: string, quantity: int, value: float}>  $top
     */
    public function __construct(
        protected Carbon $from,
        protected Carbon $to,
        protected int $units,
        protected float $value,
        protected int $activeEmployees,
        protected array $top,
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
            ->subject('Resumen de producción — semana del '.$this->from->format('d/m').' — '.config('branding.mail.brand'))
            ->view('emails.notifications.weekly-production-digest', [
                'from' => $this->from,
                'to' => $this->to,
                'units' => $this->units,
                'value' => $this->value,
                'activeEmployees' => $this->activeEmployees,
                'top' => $this->top,
                'userName' => $notifiable->name ?? '',
                'url' => route('productions.index'),
            ]);
    }
}
