<?php

namespace App\Services;

use App\Helpers\PermissionHelper;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class UserPermissionOverrideService
{
    public function __construct(
        protected PermissionRegistrar $permissionRegistrar,
        protected EffectivePermissionService $effectivePermissionService,
    ) {}

    public function setOverride(User $user, string $permissionName, string $effect, ?string $note, User $actor): void
    {
        $this->assertTargetAllowsOverrides($user);
        $this->assertSameCompany($actor, $user);

        if (! in_array($effect, [UserPermissionOverride::EFFECT_GRANT, UserPermissionOverride::EFFECT_DENY], true)) {
            throw new \InvalidArgumentException('Efecto invalido.');
        }

        if (! PermissionHelper::permissionExists($permissionName)) {
            throw new \InvalidArgumentException('Permiso no catalogado: '.$permissionName);
        }

        $permission = Permission::query()->where('name', $permissionName)->where('guard_name', 'web')->first();
        if (! $permission) {
            throw new \InvalidArgumentException('Permiso no encontrado en base de datos.');
        }

        UserPermissionOverride::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'permission_id' => $permission->id,
            ],
            [
                'company_id' => $user->company_id,
                'effect' => $effect,
                'note' => $note,
                'created_by_user_id' => $actor->id,
            ],
        );

        $this->flushCaches($user);
    }

    public function removeOverride(User $user, string $permissionName): void
    {
        $this->assertTargetAllowsOverrides($user);

        $permission = Permission::query()->where('name', $permissionName)->where('guard_name', 'web')->first();
        if (! $permission) {
            return;
        }

        UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->where('permission_id', $permission->id)
            ->delete();

        $this->flushCaches($user);
    }

    /**
     * @return Collection<int, array{permission: string, effect: string, note: ?string}>
     */
    public function listOverridesForUi(User $user): Collection
    {
        return $this->effectivePermissionService
            ->listOverridesForUser($user)
            ->map(fn (UserPermissionOverride $row) => [
                'permission' => (string) $row->permission->name,
                'effect' => $row->effect,
                'note' => $row->note,
            ])
            ->values();
    }

    public function clearAllOverrides(User $user): void
    {
        $this->assertTargetAllowsOverrides($user);

        UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->delete();

        $this->flushCaches($user);
    }

    /**
     * @param  array<int, array{permission: string, effect: string}>  $rows
     */
    public function syncOverridesFromRequest(User $user, array $rows, User $actor): void
    {
        $this->assertTargetAllowsOverrides($user);
        $this->assertSameCompany($actor, $user);

        DB::transaction(function () use ($user, $rows, $actor): void {
            UserPermissionOverride::query()
                ->where('user_id', $user->id)
                ->where('company_id', $user->company_id)
                ->delete();

            foreach ($rows as $row) {
                $permName = (string) ($row['permission'] ?? '');
                $effect = (string) ($row['effect'] ?? '');

                if ($permName === '' || ! PermissionHelper::permissionExists($permName)) {
                    continue;
                }

                if (! in_array($effect, [UserPermissionOverride::EFFECT_GRANT, UserPermissionOverride::EFFECT_DENY], true)) {
                    continue;
                }

                $permission = Permission::query()->where('name', $permName)->where('guard_name', 'web')->first();
                if (! $permission) {
                    continue;
                }

                UserPermissionOverride::query()->create([
                    'user_id' => $user->id,
                    'permission_id' => $permission->id,
                    'company_id' => $user->company_id,
                    'effect' => $effect,
                    'note' => null,
                    'created_by_user_id' => $actor->id,
                ]);
            }
        });

        $this->flushCaches($user);
    }

    protected function assertTargetAllowsOverrides(User $user): void
    {
        if ($user->isSuperAdmin()) {
            throw new \InvalidArgumentException('No se permiten excepciones para super administrador.');
        }

        if (! $user->company_id) {
            throw new \InvalidArgumentException('El usuario debe pertenecer a una empresa.');
        }
    }

    protected function assertSameCompany(User $actor, User $target): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }

        if ((int) $actor->company_id !== (int) $target->company_id) {
            throw new \InvalidArgumentException('No puedes modificar permisos de usuarios de otra empresa.');
        }
    }

    protected function flushCaches(User $user): void
    {
        $this->permissionRegistrar->forgetCachedPermissions();
        $user->flushEffectivePermissionCache();
    }
}
