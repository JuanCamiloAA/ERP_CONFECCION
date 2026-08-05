<?php

namespace App\Policies;

use App\Models\PayrollLegalParameter;
use App\Models\User;
use App\Support\TenantContext;

/**
 * Admin de empresa: puede crear/editar/eliminar solo las filas de SU company_id.
 * super_admin: control exclusivo sobre la fila global (company_id null); ademas puede gestionar
 * la fila de la empresa activa seleccionada, igual que ya hace con PayrollConcept (§4.6).
 */
class PayrollLegalParameterPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('payroll_legal_parameters.index.view');
    }

    public function view(User $user, PayrollLegalParameter $parameter): bool
    {
        if (! $user->can('payroll_legal_parameters.index.view')) {
            return false;
        }

        if ($parameter->company_id === null) {
            return true; // la fila global es visible de solo lectura para cualquiera con el permiso
        }

        return $this->ownsCompanyContext($user, (int) $parameter->company_id);
    }

    public function create(User $user): bool
    {
        if (! $user->can('payroll_legal_parameters.index.create')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->company_id !== null;
    }

    public function update(User $user, PayrollLegalParameter $parameter): bool
    {
        if (! $user->can('payroll_legal_parameters.index.edit')) {
            return false;
        }

        if ($parameter->company_id === null) {
            return $user->isSuperAdmin();
        }

        return $this->ownsCompanyContext($user, (int) $parameter->company_id);
    }

    public function delete(User $user, PayrollLegalParameter $parameter): bool
    {
        if (! $user->can('payroll_legal_parameters.index.delete')) {
            return false;
        }

        if ($parameter->company_id === null) {
            return $user->isSuperAdmin();
        }

        return $this->ownsCompanyContext($user, (int) $parameter->company_id);
    }

    protected function ownsCompanyContext(User $user, int $parameterCompanyId): bool
    {
        if ($user->isSuperAdmin()) {
            $selected = TenantContext::superAdminSelectedCompanyId();

            return $selected !== null && (int) $selected === $parameterCompanyId;
        }

        return (int) $user->company_id === $parameterCompanyId;
    }
}
