<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use App\Services\CompanyDefaultRolesService;
use App\Services\Employee\EmployeeAccessService;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Un usuario nace con los permisos de su rol y despues se ajusta por persona.
 *
 * El rol es solo una plantilla: lo que decide en tiempo de ejecucion es
 * `model_has_permissions`. Asignar el rol sin copiar la plantilla dejaba al usuario nuevo
 * entrando sin poder abrir nada; eso es lo que se protege aqui, en los tres caminos por
 * donde nace un usuario y en el cambio de rol.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class UserRolePermissionsTest extends TestCase
{
    use DatabaseTransactions;

    protected Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        app(CompanyDefaultRolesService::class)->ensureDefaultRolesForCompany($this->company);
    }

    protected function role(string $name): Role
    {
        return Role::query()->where('company_id', $this->company->id)->where('name', $name)->firstOrFail();
    }

    /**
     * @return list<string>
     */
    protected function templateOf(Role $role): array
    {
        return $role->permissions()->pluck('name')->sort()->values()->all();
    }

    /**
     * @return list<string>
     */
    protected function permissionsOf(User $user): array
    {
        return collect(app(UserPermissionService::class)->namesFor($user->refresh()))->sort()->values()->all();
    }

    protected function admin(): User
    {
        $admin = User::factory()->create(['company_id' => $this->company->id]);
        $admin->syncRoles([$this->role('admin')]);
        app(UserPermissionService::class)->sync($admin, PermissionHelper::presetPermissions('admin'), $admin);

        return $admin->refresh();
    }

    public function test_el_usuario_creado_desde_usuarios_nace_con_los_permisos_de_su_rol(): void
    {
        $role = $this->role('supervisor_produccion');
        $email = 'nuevo-'.Str::lower(Str::random(8)).'@example.com';

        $this->actingAs($this->admin())
            ->post(route('users.store'), [
                'name' => 'Nuevo',
                'email' => $email,
                'password' => 'Clave-segura-123',
                'password_confirmation' => 'Clave-segura-123',
                'role_id' => $role->id,
            ])
            ->assertSessionHasNoErrors();

        $user = User::query()->where('email', $email)->firstOrFail();

        $this->assertNotEmpty($this->templateOf($role));
        $this->assertSame($this->templateOf($role), $this->permissionsOf($user));
        // Y no es solo la fila: puede usar lo que el rol permite.
        $this->assertTrue($user->can('productions.index.view'));
    }

    public function test_el_acceso_creado_desde_la_ficha_del_empleado_nace_con_los_permisos_de_su_rol(): void
    {
        $role = $this->role('operario_produccion');
        $employee = Employee::factory()->create(['company_id' => $this->company->id]);

        $user = app(EmployeeAccessService::class)->createAccount(
            $employee,
            'operaria-'.Str::lower(Str::random(8)).'@example.com',
            $role,
            ['plain' => 'Clave-segura-123', 'require_change' => true, 'reveal' => false],
        );

        $this->assertSame($this->templateOf($role), $this->permissionsOf($user));
    }

    public function test_cambiar_de_rol_trae_lo_nuevo_quita_lo_viejo_y_respeta_los_ajustes_de_la_persona(): void
    {
        $operator = $this->role('operario_produccion');
        $supervisor = $this->role('supervisor_produccion');
        $admin = $this->admin();

        $user = User::factory()->create(['company_id' => $this->company->id]);
        $user->syncRoles([$operator]);
        app(UserPermissionService::class)->initializeFromRole($user, $operator);

        // Ajustes propios: un permiso extra que ningun rol trae, y uno quitado que esta en los dos.
        $extra = 'expenses.index.view';
        $both = collect($this->templateOf($operator))->intersect($this->templateOf($supervisor))->first();
        $onlyOperator = collect($this->templateOf($operator))->diff($this->templateOf($supervisor))->first();

        $this->assertNotNull($both, 'Operario y supervisor deberian compartir algun permiso.');

        $custom = collect($this->permissionsOf($user))->reject(fn ($name) => $name === $both)->push($extra)->values()->all();
        app(UserPermissionService::class)->sync($user, $custom, $admin);

        $this->actingAs($admin)
            ->put(route('users.update', $user), [
                'name' => $user->name,
                'email' => $user->email,
                'role_id' => $supervisor->id,
            ])
            ->assertSessionHasNoErrors();

        $after = $this->permissionsOf($user);

        // Lo del supervisor que el operario no tenia, entra.
        foreach (collect($this->templateOf($supervisor))->diff($this->templateOf($operator)) as $name) {
            $this->assertContains($name, $after);
        }
        // Lo del operario que el supervisor no trae, sale.
        if ($onlyOperator !== null) {
            $this->assertNotContains($onlyOperator, $after);
        }
        // Los ajustes de la persona se conservan.
        $this->assertContains($extra, $after);
        $this->assertNotContains($both, $after);
    }

    public function test_guardar_el_usuario_sin_cambiar_el_rol_no_toca_sus_permisos(): void
    {
        $operator = $this->role('operario_produccion');
        $admin = $this->admin();

        $user = User::factory()->create(['company_id' => $this->company->id]);
        $user->syncRoles([$operator]);
        app(UserPermissionService::class)->sync($user, ['dashboard.index.view'], $admin);

        $this->actingAs($admin)
            ->put(route('users.update', $user), [
                'name' => 'Otro nombre',
                'email' => $user->email,
                'role_id' => $operator->id,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(['dashboard.index.view'], $this->permissionsOf($user));
    }

    public function test_el_comando_repara_solo_a_quien_quedo_sin_ningun_permiso(): void
    {
        $operator = $this->role('operario_produccion');
        $admin = $this->admin();

        $broken = User::factory()->create(['company_id' => $this->company->id]);
        $broken->syncRoles([$operator]);

        $customized = User::factory()->create(['company_id' => $this->company->id]);
        $customized->syncRoles([$operator]);
        app(UserPermissionService::class)->sync($customized, ['dashboard.index.view'], $admin);

        $this->artisan('users:repair-role-permissions --dry-run')->assertSuccessful();
        $this->assertSame([], $this->permissionsOf($broken));

        $this->artisan('users:repair-role-permissions')->assertSuccessful();

        $this->assertSame($this->templateOf($operator), $this->permissionsOf($broken));
        $this->assertSame(['dashboard.index.view'], $this->permissionsOf($customized));
    }
}
