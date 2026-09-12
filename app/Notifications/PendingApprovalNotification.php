<?php

namespace App\Notifications;

use App\Models\EmployeeRequest;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso de que hay una solicitud esperando revisión.
 *
 * Lo gobierna la preferencia `pending_approvals`. El resumen NO incluye montos ni cuentas:
 * se envía a quien puede aprobar, pero el correo viaja por fuera del sistema y no tiene
 * por qué llevar el dato sensible —para eso está la ficha, donde el permiso se evalúa.
 */
class PendingApprovalNotification extends Notification
{
    public function __construct(
        protected EmployeeRequest $employeeRequest,
        protected string $employeeName,
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
            ->subject('Solicitud pendiente de '.$this->employeeName.' — '.config('branding.mail.brand'))
            ->view('emails.notifications.pending-approval', [
                'typeLabel' => $this->employeeRequest->typeLabel(),
                'employeeName' => $this->employeeName,
                'createdAt' => $this->employeeRequest->created_at,
                'userName' => $notifiable->name ?? '',
                'url' => route('employees.show', $this->employeeRequest->employee_id).'#solicitudes',
            ]);
    }
}
