<?php

namespace App\Support;

use App\Models\User;

final class CompanyContext
{
    /**
     * Empresa activa para multitenancy: usuario normal usa su company_id;
     * super_admin usa sesión dedicada (vista consolidada = null).
     */
    public static function id(?User $user): ?int
    {
        return TenantContext::effectiveCompanyId($user);
    }
}
