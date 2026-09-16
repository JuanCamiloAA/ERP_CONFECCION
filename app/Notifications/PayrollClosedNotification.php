<?php

namespace App\Notifications;

use App\Models\Payroll;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso de que una nómina quedó pagada.
 *
 * Lo gobierna la preferencia `payroll_closed`; el envío se decide en
 * `AccountNotifier::payrollClosed()`, que es quien consulta la compuerta.
 *
 * El contenido cambia según quién lo reciba y eso ya viene resuelto aquí: el agregado de
 * la empresa llega en nulo para quien no pueda verlo, y el neto propio solo para quien
 * aparezca en la nómina. Así el correo no decide permisos, solo dibuja lo que le dan.
 */
class PayrollClosedNotification extends Notification
{
    public function __construct(
        protected Payroll $payroll,
        protected string $url,
        protected ?float $ownNet = null,
        protected ?int $employeeCount = null,
        protected ?float $total = null,
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
        // Para el empleado el asunto es su pago, no el cierre contable del periodo.
        $subject = $this->ownNet !== null && $this->total === null
            ? 'Tu pago de la nómina '.$this->payroll->name.' — '.config('branding.mail.brand')
            : 'Nómina pagada: '.$this->payroll->name.' — '.config('branding.mail.brand');

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.notifications.payroll-closed', [
                'payroll' => $this->payroll,
                'ownNet' => $this->ownNet,
                'employeeCount' => $this->employeeCount,
                'total' => $this->total,
                'userName' => $notifiable->name ?? '',
                'url' => $this->url,
            ]);
    }
}
