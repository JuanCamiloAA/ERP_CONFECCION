<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Rediseño del layout: lo que el marco necesita del servidor.
 *
 * El sidebar, las migas y la barra inferior se arman en el cliente a partir de
 * `accessible_pages` y de `activeCompany`; aquí se fija que esos props lleguen con la forma
 * que el catálogo de navegación espera, y que el buscador global respete permisos.
 */
class LayoutNavigationTest extends TestCase
{
    use DatabaseTransactions;

    /** Páginas que el catálogo de navegación referencia; si una cambia de nombre, el menú la pierde. */
    protected const NAVIGATION_PAGES = [
        'dashboard.index',
        'productions.index',
        'productions.ranking',
        'references.index',
        'operations.index',
        'payrolls.index',
        'advances.index',
        'expenses.index',
        'expenses.categories',
        'payroll_concepts.index',
        'payroll_legal_parameters.index',
        'holidays.index',
        'employees.index',
        'banks.index',
        'users.index',
        'roles.index',
        'reports.production',
        'reports.payroll',
        'settings.index',
        'companies.index',
        'payroll_periodicities.index',
        'dashboard_builder.index',
    ];

    protected function superAdmin(): User
    {
        $user = User::query()->whereHas('roles', fn ($q) => $q->where('name', 'super_admin'))->first();

        if (! $user) {
            $this->markTestSkipped('No hay un super administrador en la base de datos.');
        }

        return $user;
    }

    public function test_el_super_admin_alcanza_todas_las_paginas_del_menu(): void
    {
        $pages = $this->superAdmin()->getAccessiblePages();

        foreach (self::NAVIGATION_PAGES as $page) {
            $this->assertContains($page, $pages, "El menú apunta a «{$page}», que ya no existe en el catálogo.");
        }
    }

    public function test_las_rutas_del_menu_existen(): void
    {
        $routes = [
            'dashboard',
            'productions.index',
            'productions.ranking',
            'references.index',
            'operations.index',
            'payrolls.index',
            'advances.index',
            'expenses.index',
            'expense-categories.index',
            'payroll-concepts.index',
            'payroll-legal-parameters.index',
            'holidays.index',
            'employees.index',
            'banks.index',
            'users.index',
            'roles.index',
            'reports.production',
            'reports.payroll',
            'settings.index',
            'companies.index',
            'payroll-periodicities.index',
            'super-admin.membership-plans.index',
            'super-admin.landing.index',
            'super-admin.data-imports.index',
            'super-admin.dashboard-widgets.index',
            'search.global',
            'profile.edit',
        ];

        foreach ($routes as $name) {
            $this->assertTrue(
                app('router')->has($name),
                "El menú enlaza a la ruta «{$name}», que no está registrada."
            );
        }
    }

    public function test_la_empresa_activa_llega_con_su_plan(): void
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->first();

        if (! $user) {
            $this->markTestSkipped('No hay un administrador con empresa asignada.');
        }

        $response = $this->actingAs($user)->get(route('dashboard'));

        $response->assertOk();

        $company = $response->viewData('page')['props']['activeCompany'] ?? null;

        $this->assertNotNull($company, 'El layout necesita `activeCompany` para la marca del sidebar.');
        // La clave debe venir aunque el plan sea nulo: el sidebar la lee sin comprobarlo.
        $this->assertArrayHasKey('membership_plan', $company);
    }

    public function test_el_buscador_global_pide_al_menos_dos_letras(): void
    {
        $response = $this->actingAs($this->superAdmin())->getJson(route('search.global', ['q' => 'a']));

        $response->assertOk();
        $response->assertJson(['groups' => []]);
    }

    public function test_el_buscador_global_devuelve_grupos_con_url(): void
    {
        $employee = Employee::query()->first();

        if (! $employee) {
            $this->markTestSkipped('No hay empleados en la base de datos.');
        }

        $response = $this->actingAs($this->superAdmin())
            ->getJson(route('search.global', ['q' => mb_substr($employee->first_name, 0, 3)]));

        $response->assertOk();

        $groups = $response->json('groups');
        $this->assertIsArray($groups);

        foreach ($groups as $group) {
            $this->assertArrayHasKey('key', $group);
            $this->assertArrayHasKey('label', $group);

            foreach ($group['items'] as $item) {
                $this->assertArrayHasKey('id', $item);
                $this->assertArrayHasKey('title', $item);
                $this->assertArrayHasKey('url', $item);
            }
        }
    }

    public function test_el_buscador_global_omite_lo_que_el_usuario_no_puede_ver(): void
    {
        $user = User::query()
            ->whereDoesntHave('roles', fn ($q) => $q->where('name', 'super_admin'))
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $candidate) => ! $candidate->can('employees.index.view'));

        if (! $user) {
            $this->markTestSkipped('No hay un usuario sin permiso de ver empleados.');
        }

        $response = $this->actingAs($user)->getJson(route('search.global', ['q' => 'ana']));

        $response->assertOk();

        $keys = collect($response->json('groups'))->pluck('key')->all();
        $this->assertNotContains('employees', $keys);
    }

    public function test_el_buscador_global_exige_sesion(): void
    {
        $this->get(route('search.global', ['q' => 'ana']))->assertRedirect(route('login'));
    }
}
