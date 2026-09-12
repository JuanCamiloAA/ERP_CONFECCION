<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

/**
 * Toda decision de permiso de la ficha 360 pasa por aqui.
 *
 * El frontend no evalua nada: recibe el resultado ya calculado en `permissions` y solo lo
 * pinta. Entrar por la ruta directa sin permiso devuelve 403 por la misma policy, asi que
 * ocultar un boton nunca es lo que protege el dato.
 *
 * Dos reglas cruzan todo el archivo:
 *   - Alcance por empresa: nadie ve un empleado de otra empresa, ni siquiera para leer.
 *   - «Self»: el empleado siempre puede ver su propia ficha aunque no tenga ni un permiso
 *     del modulo de empleados —es justamente el caso del operario en /profile.
 */
class EmployeePolicy
{
    /** Secciones que admite el guardado parcial de la ficha. */
    public const SECTIONS = ['identity', 'contact', 'payroll', 'bank', 'notes', 'lifecycle'];

    /** Secciones que el propio empleado puede guardar sin pasar por una solicitud. */
    public const SELF_EDITABLE_SECTIONS = ['identity', 'contact'];

    public function before(User $user): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('employees.index.view');
    }

    public function view(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        if ($this->isSelf($user, $employee)) {
            return true;
        }

        return $user->can('employees.show.view') || $user->can('employees.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('employees.index.create');
    }

    public function update(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $user->can('employees.index.edit');
    }

    public function delete(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $user->can('employees.index.delete');
    }

    /**
     * Gestionar la cuenta de acceso.
     *
     * Ademas de administrar usuarios, valen los permisos granulares del propio modulo
     * (`employees.access.*`): son los que ya protegian estas acciones en las rutas, y
     * exigir tambien `users.index.edit` dejaria fuera a roles a medida que hoy funcionan.
     */
    public function manageAccess(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $user->can('users.index.edit')
            || $user->isAdmin()
            || $user->canAny([
                'employees.access.create',
                'employees.access.toggle',
                'employees.access.change_role',
                'employees.access.reset_password',
            ]);
    }

    /**
     * Guardado por seccion.
     *
     * El empleado edita su identidad y su contacto; lo demas —nomina, cuenta bancaria,
     * ciclo de vida— exige permiso administrativo, y la cuenta bancaria ademas exige
     * poder verla: cambiar a ciegas un numero que no se puede leer es un error esperando.
     */
    public function updateSection(User $user, Employee $employee, string $section = 'identity'): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        if (! in_array($section, self::SECTIONS, true)) {
            return false;
        }

        if ($this->isSelf($user, $employee) && in_array($section, self::SELF_EDITABLE_SECTIONS, true)) {
            return true;
        }

        if (! $user->can('employees.profile.edit_section')) {
            return false;
        }

        if ($section === 'bank') {
            return $this->viewBankAccount($user, $employee);
        }

        if ($section === 'payroll') {
            return $this->viewSalary($user, $employee);
        }

        if ($section === 'lifecycle') {
            return $user->can('employees.profile.manage_lifecycle');
        }

        return true;
    }

    public function viewSalary(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $this->isSelf($user, $employee) || $user->can('employees.profile.view_salary');
    }

    public function viewBankAccount(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $this->isSelf($user, $employee) || $user->can('employees.profile.view_bank_account');
    }

    public function viewAudit(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $user->can('employees.profile.view_audit');
    }

    public function viewRequests(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $this->isSelf($user, $employee) || $user->can('employees.requests.view');
    }

    public function approveRequests(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        // Nadie aprueba lo que el mismo pidio, por mucho permiso que tenga: una solicitud
        // que se firma sola no es una solicitud.
        if ($this->isSelf($user, $employee)) {
            return false;
        }

        return $user->can('employees.requests.approve');
    }

    /**
     * Radicar una solicitud. Es del empleado sobre su propia ficha; un administrador
     * puede radicarla en su nombre si ademas puede editar la ficha.
     */
    public function createRequest(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        if ($this->isSelf($user, $employee)) {
            return true;
        }

        return $user->can('employees.profile.edit_section');
    }

    public function manageLifecycle(User $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return $user->can('employees.profile.manage_lifecycle');
    }

    /**
     * Alcance por empresa.
     *
     * El super admin no llega aqui (lo corta `before`), asi que un `company_id` nulo en el
     * usuario es una cuenta sin empresa: no ve a nadie.
     */
    protected function sameCompany(User $user, Employee $employee): bool
    {
        return $user->company_id !== null
            && (int) $employee->company_id === (int) $user->company_id;
    }

    protected function isSelf(User $user, Employee $employee): bool
    {
        return $user->employee_id !== null && (int) $user->employee_id === (int) $employee->id;
    }
}
