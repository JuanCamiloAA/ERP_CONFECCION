<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionInsightService;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Pantallas de Roles y Usuarios tras el rediseno.
 *
 * Lo que se protege: que los conteos que pinta la interfaz («+3 extra», «−1», cobertura por
 * modulo) los calcule el servidor y lleguen a la pantalla, que el enlace cruzado
 * rol → usuarios filtre de verdad, y que la ficha del usuario sepa comparar sus permisos
 * con la plantilla de su rol.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class RolesUsersScreensTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()->get()->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay super admin en esta base.');
        }

        return $user;
    }

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

    public function test_the_roles_list_exposes_coverage_audience_and_metrics(): void
    {
        $this->actingAs($this->actor())
            ->get(route('roles.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Roles/Index')
                ->has('roles.data.0.permissions_count')
                ->has('roles.data.0.permissions_total')
                ->has('roles.data.0.users_count')
                ->has('roles.data.0.modules')
                ->has('roles.data.0.avatars')
                ->has('metrics.roles_total')
                ->has('metrics.system_total')
                ->has('metrics.users_with_role')
                ->has('metrics.users_with_overrides')
                ->has('metrics.roles_without_users'));
    }

    public function test_the_role_detail_exposes_module_coverage_and_its_users(): void
    {
        $role = Role::query()->first();

        if ($role === null) {
            $this->markTestSkipped('No hay roles en esta base.');
        }

        $this->actingAs($this->actor())
            ->get(route('roles.show', $role->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Roles/Show')
                ->has('moduleCoverage.0.module')
                ->has('moduleCoverage.0.count')
                ->has('moduleCoverage.0.total')
                ->has('users')
                ->has('permissionsTotal'));
    }

    public function test_the_users_list_exposes_the_permission_counts_and_the_role_filter(): void
    {
        $this->actingAs($this->actor())
            ->get(route('users.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Users/Index')
                ->has('users.data.0.permissions_count')
                ->has('users.data.0.extra_count')
                ->has('users.data.0.missing_count')
                ->has('roles')
                ->has('metrics.active')
                ->has('metrics.inactive')
                ->has('metrics.with_overrides')
                ->has('metrics.never_logged_in'));
    }

    public function test_the_role_link_filters_the_users_list(): void
    {
        $role = Role::query()
            ->whereHas('users')
            ->first() ?? Role::query()->first();

        if ($role === null) {
            $this->markTestSkipped('No hay roles en esta base.');
        }

        $expected = User::query()
            ->whereHas('roles', fn ($q) => $q->where('roles.id', $role->id))
            ->count();

        $this->actingAs($this->actor())
            ->get(route('users.index', ['role_id' => $role->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('users.total', $expected)
                ->where('filters.role_id', $role->id));
    }

    public function test_the_user_detail_compares_against_the_role_template(): void
    {
        $user = $this->companyUser();

        $this->actingAs($this->actor())
            ->get(route('users.show', $user->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Users/Show')
                ->has('summary.assigned')
                ->has('summary.extra')
                ->has('summary.missing')
                ->has('summary.template')
                ->has('moduleCoverage.0.extra')
                ->has('moduleCoverage.0.missing')
                ->has('canManagePermissions'));
    }

    public function test_the_user_form_carries_the_origin_breakdown(): void
    {
        $user = $this->companyUser();

        $this->actingAs($this->actor())
            ->get(route('users.edit', $user->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Users/Edit')
                ->has('assigned_permissions')
                ->has('role_permissions')
                ->has('permission_labels')
                ->has('summary.extra')
                ->has('summary.missing'));
    }

    /**
     * Los conteos de excepcion tienen que salir del servidor y ser exactos: son lo que
     * decide si alguien revisa a una persona o la deja como esta.
     */
    public function test_the_exception_counts_are_exact(): void
    {
        $user = $this->companyUser();
        $role = $user->roles->first();

        if ($role === null) {
            $this->markTestSkipped('El usuario no tiene rol.');
        }

        $template = $role->permissions->pluck('name')->values()->all();

        if (count($template) < 2) {
            $this->markTestSkipped('La plantilla del rol es demasiado pequena para la prueba.');
        }

        // Le quitamos uno de la plantilla y le damos uno que no esta en ella. Se busca en el
        // catalogo completo porque la plantilla de «admin» ya cubre todo lo asignable.
        $extra = collect(PermissionHelper::flatPermissions())
            ->reject(fn ($name) => in_array($name, $template, true))
            ->first();

        $this->assertNotNull($extra, 'No hay un permiso fuera de la plantilla para la prueba.');

        $assigned = array_values(array_merge(array_slice($template, 1), [$extra]));
        app(UserPermissionService::class)->sync($user, $assigned, $this->actor());

        $summary = app(PermissionInsightService::class)->summaryFor($user->refresh());

        $this->assertSame(1, $summary['extra'], 'El conteo de «extra» no coincide.');
        $this->assertSame(1, $summary['missing'], 'El conteo de «quitados» no coincide.');
        $this->assertSame(count($assigned), $summary['assigned']);
    }

    public function test_module_coverage_adds_up_to_the_catalogue(): void
    {
        $coverage = app(PermissionInsightService::class)
            ->moduleCoverage(PermissionHelper::flatPermissions());

        $total = array_sum(array_column($coverage, 'total'));
        $count = array_sum(array_column($coverage, 'count'));

        $this->assertSame(count(PermissionHelper::flatPermissions()), $total);
        $this->assertSame($total, $count, 'Con todos los permisos, la cobertura debe ser completa.');
    }
}
