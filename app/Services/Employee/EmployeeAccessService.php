<?php

namespace App\Services\Employee;

use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Cuenta de acceso del empleado: crearla, restablecer su contrasena, activarla o
 * desactivarla y cambiarle el rol.
 *
 * Vive en un servicio y no en el controlador porque el alta de empleado tambien crea la
 * cuenta en el mismo paso: con la logica en dos sitios, cualquier regla nueva —una
 * validacion de rol, una linea de bitacora— se aplicaria solo en uno de los dos caminos.
 */
class EmployeeAccessService
{
    public function __construct(protected EmployeeAuditLogger $audit) {}

    /**
     * Contrasena de la cuenta: la que envio el administrador o una temporal generada aqui.
     *
     * `reveal` indica si debe mostrarse al administrador (solo cuando no la definio el).
     *
     * @return array{plain: string, require_change: bool, reveal: bool}
     */
    public function resolvePassword(Request $request): array
    {
        $plain = trim((string) $request->input('user_password', ''));
        $wasGenerated = $plain === '';

        if ($wasGenerated) {
            $plain = $this->generateTemporaryPassword();
        }

        return [
            'plain' => $plain,
            'require_change' => $request->boolean('require_password_change', true),
            'reveal' => $wasGenerated || $request->input('password_mode', 'auto') !== 'manual',
        ];
    }

    public function generateTemporaryPassword(): string
    {
        $upper = Str::upper(Str::random(2));
        $lower = Str::lower(Str::random(4));
        $number = (string) random_int(100, 999);
        $special = collect(['#', '@', '$', '%', '!', '&'])->random();

        return $upper.$lower.$number.$special;
    }

    /**
     * Crea la cuenta y la vincula al empleado.
     *
     * @param  array{plain: string, require_change: bool, reveal: bool}  $password
     */
    public function createAccount(Employee $employee, string $email, ?Role $role, array $password, ?User $actor = null): User
    {
        $user = User::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'email' => $email,
            'password' => Hash::make($password['plain']),
            'phone' => $employee->phone,
            'is_active' => true,
            'password_change_required' => $password['require_change'],
            // Sella la antiguedad desde el primer dia: es la columna que lee «Mi perfil».
            'password_changed_at' => now(),
        ]);

        if ($role) {
            $user->assignRole($role);
        }

        $employee->user_id = $user->id;

        // Crear el acceso adelanta el ciclo de vida si aun estaba en los pasos previos;
        // nunca lo retrocede ni resucita a un retirado.
        if (in_array($employee->lifecycleStatus(), [Employee::LIFECYCLE_HIRED, Employee::LIFECYCLE_DOCUMENTS_OK], true)) {
            $employee->lifecycle_status = Employee::LIFECYCLE_ACCESS_CREATED;
        }

        $employee->save();
        $employee->setRelation('user', $user);

        $this->audit->log($employee, EmployeeAuditLog::EVENT_ACCESS_CREATED, 'access', null, $email, $actor);

        if ($role) {
            $this->audit->log($employee, EmployeeAuditLog::EVENT_ROLE_CHANGED, 'role', null, $role->display_name ?? $role->name, $actor);
        }

        return $user;
    }

    /**
     * Valida que el rol se pueda asignar en esta empresa.
     *
     * @return string|null mensaje de error, o null si es valido.
     */
    public function roleRejectionReason(?Role $role, Employee $employee, User $actor): ?string
    {
        if (! $role) {
            return 'Rol no encontrado.';
        }

        if ($role->name === 'super_admin' && ! $actor->isSuperAdmin()) {
            return 'Rol no permitido.';
        }

        if ($role->company_id === null && ! $actor->isSuperAdmin()) {
            return 'Rol no válido para esta empresa.';
        }

        if ($role->company_id !== null && (int) $role->company_id !== (int) $employee->company_id) {
            return 'El rol no pertenece a la empresa del empleado.';
        }

        return null;
    }

    public function changeRole(Employee $employee, Role $role, ?User $actor = null): void
    {
        $previous = $employee->user->roles->first();

        $employee->user->syncRoles([$role]);

        $this->audit->log(
            $employee,
            EmployeeAuditLog::EVENT_ROLE_CHANGED,
            'role',
            $previous?->display_name ?? $previous?->name,
            $role->display_name ?? $role->name,
            $actor,
        );
    }

    public function resetPassword(Employee $employee, bool $requireChange, ?User $actor = null): string
    {
        $temporary = $this->generateTemporaryPassword();

        $employee->user->password = Hash::make($temporary);
        $employee->user->password_change_required = $requireChange;
        $employee->user->password_changed_at = now();
        $employee->user->save();

        $this->audit->log($employee, EmployeeAuditLog::EVENT_PASSWORD_RESET, 'password', 'anterior', 'temporal', $actor);

        return $temporary;
    }

    public function toggle(Employee $employee, ?User $actor = null): bool
    {
        $was = (bool) $employee->user->is_active;

        $employee->user->is_active = ! $was;
        $employee->user->save();

        $this->audit->log(
            $employee,
            EmployeeAuditLog::EVENT_ACCESS_TOGGLED,
            'access',
            $was ? 'Activa' : 'Desactivada',
            $was ? 'Desactivada' : 'Activa',
            $actor,
        );

        return ! $was;
    }
}
