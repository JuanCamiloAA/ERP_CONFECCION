<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleTemplateService;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * El rol como plantilla y los permisos por usuario.
 *
 * Lo que se protege: que lo que puede hacer una persona sea exactamente lo que tiene
 * asignado (sin herencias que reconstruir), que cambiar una plantilla no altere a nadie
 * hasta que se decida, que la propagacion aplique solo la diferencia, y que cada accion de
 * cada modulo este catalogada y exigida en su ruta.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class PermissionAssignmentTest extends TestCase
{
    use DatabaseTransactions;

    protected function companyUser(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => ! $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuarios de empresa en esta base.');
        }

        return $user;
    }

    protected function superAdmin(): User
    {
        $user = User::query()->get()->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay super admin en esta base.');
        }

        return $user;
    }

    public function test_effective_permissions_are_the_users_own_not_the_roles(): void
    {
        $user = $this->companyUser();
        $service = app(UserPermissionService::class);

        $service->sync($user, ['advances.index.view', 'advances.index.create'], $this->superAdmin());
        $user->refresh()->flushEffectivePermissionCache();

        $this->assertSame(
            ['advances.index.create', 'advances.index.view'],
            $user->getEffectivePermissionNames(),
        );

        // Aunque su rol conceda mucho mas, el efectivo es lo asignado.
        $roleGrants = $user->roles->flatMap(fn (Role $r) => $r->permissions->pluck('name'))->unique();
        if ($roleGrants->count() > 2) {
            $this->assertLessThan($roleGrants->count(), count($user->getEffectivePermissionNames()));
        }
    }

    public function test_the_assigner_only_saves_catalogued_permissions(): void
    {
        $user = $this->companyUser();

        app(UserPermissionService::class)->sync(
            $user,
            ['advances.index.view', 'modulo.inventado.accion', ''],
            $this->superAdmin(),
        );

        $user->refresh()->flushEffectivePermissionCache();

        $this->assertSame(['advances.index.view'], $user->getEffectivePermissionNames());
    }

    public function test_the_super_admin_cannot_be_assigned_permissions_one_by_one(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        app(UserPermissionService::class)->sync($this->superAdmin(), ['advances.index.view'], $this->superAdmin());
    }

    public function test_editing_a_role_does_not_change_anyone_until_it_is_propagated(): void
    {
        $user = $this->companyUser();
        $role = $user->roles->first();

        if ($role === null || $role->is_system) {
            $this->markTestSkipped('El usuario no tiene un rol editable.');
        }

        app(UserPermissionService::class)->sync($user, ['advances.index.view'], $this->superAdmin());
        $user->refresh()->flushEffectivePermissionCache();
        $before = $user->getEffectivePermissionNames();

        // La plantilla gana un permiso que el usuario no tiene.
        $role->syncPermissions(array_merge(
            $role->permissions->pluck('name')->all(),
            ['holidays.index.sync'],
        ));

        $user->refresh()->flushEffectivePermissionCache();

        $this->assertSame($before, $user->getEffectivePermissionNames());
    }

    public function test_propagation_applies_only_the_difference(): void
    {
        $user = $this->companyUser();
        $role = $user->roles->first();

        if ($role === null) {
            $this->markTestSkipped('El usuario no tiene rol.');
        }

        // Un permiso propio que la plantilla no toca: no puede desaparecer.
        app(UserPermissionService::class)->sync(
            $user,
            ['advances.index.view', 'expenses.index.view'],
            $this->superAdmin(),
        );

        app(RoleTemplateService::class)->propagate(
            $role,
            [$user->id],
            ['holidays.index.view'],
            ['expenses.index.view'],
            $this->superAdmin(),
        );

        $user->refresh()->flushEffectivePermissionCache();
        $names = $user->getEffectivePermissionNames();

        $this->assertContains('advances.index.view', $names, 'El ajuste propio del usuario se perdio.');
        $this->assertContains('holidays.index.view', $names, 'No se aplico lo agregado.');
        $this->assertNotContains('expenses.index.view', $names, 'No se aplico lo quitado.');
    }

    public function test_propagation_ignores_users_that_do_not_have_the_role(): void
    {
        $user = $this->companyUser();
        $role = Role::query()
            ->whereNotIn('id', DB::table('model_has_roles')->where('model_id', $user->id)->pluck('role_id'))
            ->first();

        if ($role === null) {
            $this->markTestSkipped('No hay un rol que el usuario no tenga.');
        }

        app(UserPermissionService::class)->sync($user, ['advances.index.view'], $this->superAdmin());

        $affected = app(RoleTemplateService::class)->propagate(
            $role,
            [$user->id],
            ['holidays.index.sync'],
            [],
            $this->superAdmin(),
        );

        $user->refresh()->flushEffectivePermissionCache();

        $this->assertSame(0, $affected);
        $this->assertNotContains('holidays.index.sync', $user->getEffectivePermissionNames());
    }

    public function test_every_catalogued_permission_exists_in_the_database(): void
    {
        $catalogue = PermissionHelper::flatPermissions();
        $stored = DB::table('permissions')->where('guard_name', 'web')->pluck('name')->all();

        $this->assertSame(
            [],
            array_values(array_diff($catalogue, $stored)),
            'Hay permisos en el catalogo sin fila en la base: falta correr las migraciones.',
        );
    }

    /**
     * Ninguna accion puede quedarse fuera del asignador.
     *
     * La tabla anterior de roles solo sabia pintar cinco verbos (ver/crear/editar/eliminar/
     * exportar), asi que «agregar operacion a la referencia» o «reordenar» existian en el
     * catalogo y en las rutas pero no habia forma de asignarlas.
     */
    public function test_every_catalogued_permission_is_reachable_in_the_assigner(): void
    {
        $inCatalogue = [];

        foreach (PermissionHelper::catalogue(true) as $module) {
            foreach ($module['groups'] as $group) {
                foreach ($group['permissions'] as $permission) {
                    $inCatalogue[] = $permission['name'];
                }
            }
        }

        sort($inCatalogue);
        $expected = PermissionHelper::flatPermissions();
        sort($expected);

        $this->assertSame($expected, $inCatalogue, 'Hay permisos que el asignador no puede mostrar.');
    }

    public function test_the_role_screens_use_the_same_catalogue_as_the_user_assigner(): void
    {
        $role = Role::query()->where('is_system', false)->first();

        if ($role === null) {
            $this->markTestSkipped('No hay roles editables en esta base.');
        }

        $admin = $this->superAdmin();

        $this->actingAs($admin)
            ->get(route('roles.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('catalogue.0.groups.0.permissions.0.label'));

        $this->actingAs($admin)
            ->get(route('roles.edit', $role->id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('catalogue.0.groups.0.permissions.0.label'));
    }

    public function test_the_catalogue_gives_every_permission_a_readable_label(): void
    {
        foreach (PermissionHelper::catalogue(true) as $module) {
            foreach ($module['groups'] as $group) {
                foreach ($group['permissions'] as $permission) {
                    $this->assertNotSame('', trim($permission['label']), "Sin etiqueta: {$permission['name']}");
                    $this->assertNotSame($permission['name'], $permission['label']);
                }
            }
        }
    }

    /**
     * Cada accion que escribe o exporta tiene que exigir su propio permiso, no el de ver.
     */
    public function test_write_routes_require_their_own_fine_grained_permission(): void
    {
        $expected = [
            'employees.store' => 'employees.index.create',
            'employees.destroy' => 'employees.index.delete',
            'employees.access.store' => 'employees.access.create',
            'references.export.excel' => 'references.index.export_excel',
            'references.operations.attach' => 'references.operations.attach',
            'operations.price' => 'operations.index.edit_price',
            'productions.confirm' => 'productions.index.confirm',
            'productions.export' => 'productions.index.export',
            'payrolls.approve' => 'payrolls.show.approve',
            'payrolls.pay' => 'payrolls.show.pay',
            'payrolls.payroll-employees.receipt' => 'payrolls.employee.receipt',
            'advances.export' => 'advances.index.export',
            'advances.show' => 'advances.show.view',
            'expenses.export' => 'expenses.index.export',
            'expenses.quick-store' => 'expenses.index.quick_create',
            'expense-categories.toggle' => 'expenses.categories.toggle',
            'holidays.sync' => 'holidays.index.sync',
            'payroll-concepts.reorder' => 'payroll_concepts.index.reorder',
            'users.permissions.update' => 'users.edit.permission_overrides',
            'roles.propagate' => 'roles.index.propagate',
        ];

        foreach ($expected as $routeName => $permission) {
            $route = app('router')->getRoutes()->getByName($routeName);

            $this->assertNotNull($route, "No existe la ruta {$routeName}.");
            $this->assertContains(
                'permission:'.$permission,
                $route->gatherMiddleware(),
                "La ruta {$routeName} no exige {$permission}.",
            );
        }
    }

    public function test_a_user_without_the_fine_permission_cannot_reach_the_action(): void
    {
        $user = $this->companyUser();

        // Puede ver anticipos, pero no exportarlos.
        app(UserPermissionService::class)->sync($user, ['advances.index.view'], $this->superAdmin());

        $this->actingAs($user->refresh())->get(route('advances.index'))->assertOk();
        $this->actingAs($user)->get(route('advances.export'))->assertForbidden();
    }

    public function test_the_assigner_endpoint_returns_the_catalogue_and_the_template(): void
    {
        $user = $this->companyUser();

        $this->actingAs($this->superAdmin())
            ->getJson(route('users.permissions.show', $user->id))
            ->assertOk()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email', 'role', 'is_super_admin'],
                'catalogue' => [['key', 'display', 'total', 'groups' => [['key', 'display', 'permissions']]]],
                'assigned',
                'template',
            ]);
    }

    public function test_saving_from_the_assigner_replaces_the_whole_set(): void
    {
        $user = $this->companyUser();

        app(UserPermissionService::class)->sync(
            $user,
            ['advances.index.view', 'expenses.index.view'],
            $this->superAdmin(),
        );

        $this->actingAs($this->superAdmin())
            ->put(route('users.permissions.update', $user->id), [
                'permissions' => ['holidays.index.view'],
            ])
            ->assertRedirect();

        $user->refresh()->flushEffectivePermissionCache();

        $this->assertSame(['holidays.index.view'], $user->getEffectivePermissionNames());
    }
}
