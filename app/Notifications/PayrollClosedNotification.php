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
 */
class PayrollClosedNotification extends Notification
{
    public function __construct(
        protected Payroll $payroll,
        protected int $employeeCount,
        protected float $total,
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
            ->subject('Nómina pagada: '.$this->payroll->name.' — '.config('branding.mail.brand'))
            ->view('emails.notifications.payroll-closed', [
                'payroll' => $this->payroll,
                'employeeCount' => $this->employeeCount,
                'total' => $this->total,
                'userName' => $notifiable->name ?? '',
                'url' => route('payrolls.show', $this->payroll->id),
            ]);
    }
}
