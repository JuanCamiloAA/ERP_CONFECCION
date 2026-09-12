<?php

namespace App\Services\Account;

use App\Models\EmployeeRequest;
use App\Models\Payroll;
use App\Models\User;
use App\Notifications\PayrollClosedNotification;
use App\Notifications\PendingApprovalNotification;
use App\Support\NotificationPreferences;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Único emisor de los avisos del catálogo de preferencias.
 *
 * Todo envío pasa por `deliver()`, que consulta `User::wantsNotification()`. Esa es la
 * razón de que la clase exista: con cada controlador mandando su propio correo, apagar una
 * casilla en el perfil no apagaría nada y la preferencia sería decorativa.
 *
 * Los fallos de correo se registran pero no propagan: el envío es síncrono (el proyecto no
 * tiene worker de colas), así que una caída del proveedor no puede tumbar el pago de una
 * nómina ni impedir que se radique una solicitud.
 */
class AccountNotifier
{
    /**
     * Avisa a los administradores de la empresa de que una nómina quedó pagada.
     */
    public function payrollClosed(Payroll $payroll, int $employeeCount, float $total): void
    {
        $recipients = $this->companyRecipients((int) $payroll->company_id, ['payrolls.index.view']);

        $this->deliver(
            $recipients,
            NotificationPreferences::PAYROLL_CLOSED,
            fn () => new PayrollClosedNotification($payroll, $employeeCount, $total),
        );
    }

    /**
     * Avisa a quien puede aprobar de que entró una solicitud.
     *
     * Se excluye a quien la radicó: nadie necesita que le avisen de lo que acaba de hacer.
     */
    public function pendingApproval(EmployeeRequest $request, string $employeeName): void
    {
        $recipients = $this->companyRecipients((int) $request->company_id, ['employees.requests.approve'])
            ->reject(fn (User $user) => (int) $user->id === (int) $request->requested_by);

        $this->deliver(
            $recipients,
            NotificationPreferences::PENDING_APPROVALS,
            fn () => new PendingApprovalNotification($request, $employeeName),
        );
    }

    /**
     * Destinatarios de una empresa que tengan alguno de los permisos dados.
     *
     * El super admin queda fuera a propósito: ve todas las empresas y recibiría un correo
     * por cada nómina de cada cliente.
     *
     * @param  list<string>  $permissions
     * @return Collection<int, User>
     */
    public function companyRecipients(int $companyId, array $permissions): Collection
    {
        if ($companyId <= 0) {
            return collect();
        }

        return User::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotNull('email')
            ->get()
            ->reject(fn (User $user) => $user->isSuperAdmin())
            ->filter(fn (User $user) => $user->canAny($permissions))
            ->values();
    }

    /**
     * Envía respetando la preferencia de cada persona.
     *
     * @param  Collection<int, User>  $recipients
     * @param  callable(): \Illuminate\Notifications\Notification  $factory
     */
    public function deliver(Collection $recipients, string $preferenceKey, callable $factory): int
    {
        $sent = 0;

        foreach ($recipients as $user) {
            if (! $user->wantsNotification($preferenceKey)) {
                continue;
            }

            try {
                $user->notify($factory());
                $sent++;
            } catch (\Throwable $e) {
                Log::warning('No se pudo enviar el aviso "'.$preferenceKey.'" a '.$user->email, [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }
}
