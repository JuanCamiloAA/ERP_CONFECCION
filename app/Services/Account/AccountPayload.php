<?php

namespace App\Services\Account;

use App\Models\Employee;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use App\Services\Files\MediaUrlResolver;
use App\Support\NotificationPreferences;
use Illuminate\Http\Request;

/**
 * Payload de «Mi perfil» para la cuenta de acceso.
 *
 * Es lo que la pantalla necesita para pintarse entera de una carga: identidad, estado real
 * de seguridad, sesiones y preferencias. Nada de esto se calcula en el navegador —la
 * antiguedad de la contrasena y el estado de la 2FA salen de la base, no de un texto fijo,
 * que es justo lo que la pantalla anterior no hacia.
 */
class AccountPayload
{
    /** A partir de aqui la contrasena se marca «Antigua». */
    public const PASSWORD_STALE_DAYS = 180;

    public function __construct(
        protected MediaUrlResolver $media,
        protected SessionInspector $sessions,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $user, Request $request): array
    {
        $user->loadMissing('roles');
        $role = $user->roles->first();

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'lastName' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'jobTitle' => $user->job_title,
                'photoUrl' => $this->media->url($user->getAttributes()['avatar'] ?? null),
                'initials' => $user->initials,
                'fullName' => $user->full_name,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name ?? $role->name,
                ] : null,
                'company' => $user->company_id ? [
                    'id' => $user->company_id,
                    'name' => $user->company?->name,
                ] : null,
            ],
            'security' => $this->security($user),
            'sessions' => $this->sessions->forUser($user, $request->session()->getId()),
            'sessionsSupported' => $this->sessions->isSupported(),
            'preferences' => $user->notificationPreferences(),
            'preferenceCatalogue' => $this->preferenceCatalogue(),
            'employeeLinked' => $user->employee_id !== null,
            'linking' => $this->linking($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function security(User $user): array
    {
        $changedAt = $user->password_changed_at;
        // `diffInDays` de Carbon 3 devuelve float; la pantalla cuenta dias enteros.
        $ageDays = $changedAt ? (int) floor(abs($changedAt->diffInDays(now()))) : null;

        return [
            'email' => $user->email,
            'emailVerifiedAt' => $user->email_verified_at?->toIso8601String(),
            'pendingEmail' => $user->pending_email,
            'pendingEmailRequestedAt' => $user->pending_email_requested_at?->toIso8601String(),
            'passwordChangedAt' => $changedAt?->toIso8601String(),
            'passwordAgeDays' => $ageDays,
            'passwordIsStale' => $ageDays !== null && $ageDays > self::PASSWORD_STALE_DAYS,
            'passwordStaleAfterDays' => self::PASSWORD_STALE_DAYS,
            'passwordChangeRequired' => (bool) $user->password_change_required,
            'twoFactorEnabled' => $user->hasTwoFactorEnabled(),
            // Secreto guardado pero sin confirmar: el alta quedó a medias y la pantalla
            // debe ofrecer terminarla, no empezar otra.
            'twoFactorPending' => $user->two_factor_secret !== null && $user->two_factor_confirmed_at === null,
            'twoFactorConfirmedAt' => $user->two_factor_confirmed_at?->toIso8601String(),
            'recoveryCodesLeft' => count(app(TwoFactorService::class)->recoveryCodes($user)),
        ];
    }

    /**
     * @return list<array{key: string, label: string, description: string}>
     */
    protected function preferenceCatalogue(): array
    {
        $out = [];

        foreach (NotificationPreferences::catalogue() as $key => $item) {
            $out[] = [
                'key' => $key,
                'label' => $item['label'],
                'description' => $item['description'],
            ];
        }

        return $out;
    }

    /**
     * Vinculación con una ficha de empleado.
     *
     * Solo se ofrece a quien ya puede administrar empleados de su empresa: reclamar una
     * ficha ajena da acceso a su nómina y a su cuenta bancaria, así que no puede ser una
     * acción de autoservicio para cualquiera. A los demás la tarjeta les explica a quién
     * pedirlo, en vez de mostrar un botón que devolvería 403.
     *
     * @return array<string, mixed>
     */
    protected function linking(User $user): array
    {
        if ($user->employee_id !== null) {
            return ['canLink' => false, 'candidates' => [], 'reason' => null];
        }

        $canLink = $user->isSuperAdmin() || $user->can('employees.index.edit');

        if (! $canLink) {
            return [
                'canLink' => false,
                'candidates' => [],
                'reason' => 'Solo un administrador de tu empresa puede vincular tu cuenta a una ficha de empleado.',
            ];
        }

        if (! $user->company_id) {
            return [
                'canLink' => false,
                'candidates' => [],
                'reason' => 'Tu cuenta no pertenece a ninguna empresa, así que no hay fichas que vincular.',
            ];
        }

        // Candidatas: fichas de su empresa que todavía no tienen cuenta de acceso.
        $candidates = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->whereNull('user_id')
            ->orderBy('first_name')
            ->limit(200)
            ->get(['id', 'first_name', 'last_name', 'document_type', 'document_number'])
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'full_name' => $employee->full_name,
                'document' => trim($employee->document_type.' '.$employee->document_number),
            ])
            ->values()
            ->all();

        return ['canLink' => true, 'candidates' => $candidates, 'reason' => null];
    }
}
