<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

final class TenantContext
{
    public const SESSION_KEY = 'super_admin_active_company_id';

    public const LEGACY_SESSION_KEY = 'active_company_id';

    /**
     * Migra la clave antigua una sola vez por petición (compatibilidad).
     */
    public static function migrateLegacySession(): void
    {
        $user = Auth::user();
        if (! $user?->isSuperAdmin()) {
            return;
        }
        if (! session()->has(self::LEGACY_SESSION_KEY)) {
            return;
        }
        $legacy = session(self::LEGACY_SESSION_KEY);
        session()->forget(self::LEGACY_SESSION_KEY);
        if ($legacy === null || $legacy === '') {
            return;
        }
        if (! session()->has(self::SESSION_KEY)) {
            session([self::SESSION_KEY => (int) $legacy]);
        }
    }

    public static function superAdminSelectedCompanyId(): ?int
    {
        self::migrateLegacySession();
        $user = Auth::user();
        if (! $user?->isSuperAdmin()) {
            return null;
        }
        $raw = session(self::SESSION_KEY);
        if ($raw === null || $raw === '') {
            return null;
        }

        return (int) $raw;
    }

    public static function isConsolidatedSuperAdmin(?User $user = null): bool
    {
        $user = $user ?? Auth::user();

        return (bool) $user?->isSuperAdmin() && self::superAdminSelectedCompanyId() === null;
    }

    /**
     * Empresa efectiva para lecturas y listados: admin de empresa siempre su company_id;
     * super admin null = consolidado; super admin con sesión = id seleccionado.
     */
    public static function effectiveCompanyId(?User $user = null): ?int
    {
        $user = $user ?? Auth::user();
        if (! $user) {
            return null;
        }

        if ($user->isSuperAdmin()) {
            return self::superAdminSelectedCompanyId();
        }

        return $user->company_id ? (int) $user->company_id : null;
    }

    /**
     * company_id obligatorio para altas/modificaciones que no pueden ser globales.
     *
     * @throws ValidationException
     */
    public static function requireCompanyIdForWrite(?User $user = null): int
    {
        $user = $user ?? Auth::user();
        $id = self::effectiveCompanyId($user);
        if ($id !== null) {
            return $id;
        }

        if ($user?->isSuperAdmin()) {
            throw ValidationException::withMessages([
                'company_id' => ['Seleccione una empresa en la parte superior para registrar datos.'],
            ]);
        }

        throw ValidationException::withMessages([
            'company_id' => ['No se pudo determinar la empresa.'],
        ]);
    }
}
