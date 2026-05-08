<?php

namespace App\Support;

use App\Models\User;

final class CompanyContext
{
    /**
     * Empresa activa para multitenancy: usuario normal usa su company_id;
     * superadmin usa la sesion active_company_id.
     */
    public static function id(?User $user): ?int
    {
        if (! $user) {
            return null;
        }

        if ($user->isSuperAdmin()) {
            $sessionId = session('active_company_id');

            return $sessionId ? (int) $sessionId : null;
        }

        return $user->company_id ? (int) $user->company_id : null;
    }
}
