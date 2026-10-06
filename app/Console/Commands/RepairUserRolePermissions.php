<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\UserPermissionService;
use Illuminate\Console\Command;

/**
 * Repara los usuarios que nacieron sin permisos.
 *
 * Crear un usuario (desde Usuarios, desde la ficha del empleado o por carga masiva) le
 * asignaba el rol pero no le copiaba la plantilla, y como lo que decide es
 * `model_has_permissions`, entraba sin poder abrir nada. Este comando le aplica la
 * plantilla de su rol solo a quien tiene rol y CERO permisos propios: a nadie que ya
 * tenga algo asignado se le toca nada.
 */
class RepairUserRolePermissions extends Command
{
    protected $signature = 'users:repair-role-permissions {--dry-run : Solo lista a quien repararia}';

    protected $description = 'Aplica la plantilla de su rol a los usuarios que quedaron con rol y sin ningun permiso';

    public function handle(UserPermissionService $permissions): int
    {
        $dry = (bool) $this->option('dry-run');
        $repaired = 0;

        $candidates = User::query()
            ->whereNotNull('company_id')
            ->whereHas('roles', fn ($query) => $query->where('name', '!=', 'super_admin'))
            ->whereDoesntHave('permissions')
            ->with('roles')
            ->get();

        foreach ($candidates as $user) {
            $role = $user->roles->first();

            if ($user->isSuperAdmin() || ! $role || $role->permissions()->doesntExist()) {
                continue;
            }

            $this->line("{$user->email} ({$role->display_name}): {$role->permissions()->count()} permisos de la plantilla");

            if (! $dry) {
                $permissions->initializeFromRole($user, $role);
            }

            $repaired++;
        }

        $this->info($dry
            ? "Se repararian {$repaired} usuarios. Corre sin --dry-run para aplicarlo."
            : "Usuarios reparados: {$repaired}.");

        return self::SUCCESS;
    }
}
