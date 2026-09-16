<?php

namespace App\Services\Account;

use App\Models\EmployeeRequest;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
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
     * Avisa del cierre de una nómina a quien tenga acceso al módulo.
     *
     * El mismo aviso le llega al administrador y al empleado que tiene usuario, así que el
     * cuerpo se arma por destinatario: el agregado de la empresa —cuántos se liquidaron y
     * cuánto sumó— solo lo lleva quien tenga `payrolls.show.view_totals`, y quien aparezca
     * en la nómina ve su propio neto. Mandar una sola copia con el total general le decía a
     * cada operario lo que cuesta la empresa entera.
     */
    public function payrollClosed(Payroll $payroll, int $employeeCount, float $total): void
    {
        $recipients = $this->companyRecipients((int) $payroll->company_id, ['payrolls.index.view']);

        $ownRows = $this->ownRowsFor($payroll, $recipients);

        $this->deliver(
            $recipients,
            NotificationPreferences::PAYROLL_CLOSED,
            function (User $user) use ($payroll, $employeeCount, $total, $ownRows) {
                $ownRow = $ownRows[(int) $user->employee_id] ?? null;
                $canSeeTotals = $user->can('payrolls.show.view_totals');

                return new PayrollClosedNotification(
                    payroll: $payroll,
                    url: $this->payrollUrlFor($user, $payroll, $ownRow),
                    ownNet: $ownRow ? (float) $ownRow->net_payment : null,
                    employeeCount: $canSeeTotals ? $employeeCount : null,
                    total: $canSeeTotals ? $total : null,
                );
            },
        );
    }

    /**
     * Fila de cada destinatario dentro de la nómina, cuando además es empleado de ella.
     *
     * Una sola consulta para todos: el aviso sale dentro del cierre, que es síncrono.
     *
     * @param  Collection<int, User>  $recipients
     * @return array<int, PayrollEmployee>
     */
    private function ownRowsFor(Payroll $payroll, Collection $recipients): array
    {
        $employeeIds = $recipients
            ->pluck('employee_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($employeeIds->isEmpty()) {
            return [];
        }

        return PayrollEmployee::query()
            ->where('payroll_id', $payroll->id)
            ->whereIn('employee_id', $employeeIds)
            ->get(['id', 'payroll_id', 'employee_id', 'net_payment'])
            ->keyBy(fn (PayrollEmployee $row) => (int) $row->employee_id)
            ->all();
    }

    /**
     * A dónde lleva el botón del correo: a la ficha propia si la persona aparece en la
     * nómina y puede abrirla, al detalle del periodo si no. El enlace no puede apuntar a
     * una pantalla que el permiso le va a negar.
     */
    private function payrollUrlFor(User $user, Payroll $payroll, ?PayrollEmployee $ownRow): string
    {
        if ($ownRow !== null && $user->can('payrolls.employee.view')) {
            return route('payrolls.payroll-employees.show', [$payroll->id, $ownRow->id]);
        }

        if ($user->can('payrolls.show.view')) {
            return route('payrolls.show', $payroll->id);
        }

        return route('payrolls.index');
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
     * El `$factory` recibe al destinatario: hay avisos cuyo cuerpo cambia segun lo que
     * esa persona tenga permitido ver.
     *
     * @param  Collection<int, User>  $recipients
     * @param  callable(User): \Illuminate\Notifications\Notification  $factory
     */
    public function deliver(Collection $recipients, string $preferenceKey, callable $factory): int
    {
        $sent = 0;

        foreach ($recipients as $user) {
            if (! $user->wantsNotification($preferenceKey)) {
                continue;
            }

            try {
                $user->notify($factory($user));
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
