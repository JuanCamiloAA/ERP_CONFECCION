<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\MembershipPlan;
use App\Models\PayrollPeriodicity;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Rediseno de Empresas, Mi empresa, Periodicidad de pagos y Planes de membresia.
 *
 * Se comprueba lo que las pantallas nuevas dan por hecho: los props que piden, los filtros
 * que estrenan y las validaciones que antes no existian.
 */
class ModuleRedesignTest extends TestCase
{
    use DatabaseTransactions;

    protected function superAdmin(): User
    {
        $user = User::query()->whereHas('roles', fn ($q) => $q->where('name', 'super_admin'))->first();

        if (! $user) {
            $this->markTestSkipped('No hay un super administrador en la base de datos.');
        }

        return $user;
    }

    public function test_companies_index_entrega_los_props_que_la_pantalla_necesita(): void
    {
        $response = $this->actingAs($this->superAdmin())->get(route('companies.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Companies/Index')
            ->has('companies.data')
            ->has('stats', 4)
            ->has('summary.total')
            ->has('summary.staff_used')
            ->has('chipCounts.all')
            ->has('chipCounts.at_limit')
            ->has('chipCounts.expiring')
            ->has('plans')
            ->where('filters.status', 'all'));
    }

    public function test_mi_empresa_entrega_el_estado_de_la_membresia(): void
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('settings.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario de empresa con permiso settings.index.view.');
        }

        $response = $this->actingAs($user)->get(route('settings.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Settings/Index')
            ->has('membership.plan')
            ->has('membership.ends_at')
            ->has('membership.days_left')
            ->has('membership.is_expired')
            ->has('membership.usage.staff_used')
            ->has('membership.usage.staff_limit')
            ->has('membership.usage.employees_used')
            ->has('membership.usage.employees_limit'));
    }

    public function test_companies_index_expone_los_conteos_de_staff_y_empleados_por_fila(): void
    {
        $response = $this->actingAs($this->superAdmin())->get(route('companies.index'));

        $rows = $response->viewData('page')['props']['companies']['data'];

        if ($rows === []) {
            $this->markTestSkipped('No hay empresas en la base de datos.');
        }

        $this->assertArrayHasKey('staff_users_count', $rows[0]);
        $this->assertArrayHasKey('employees_count', $rows[0]);
    }

    /** Los empleados llevan CompanyScope: el conteo debe ser el de cada fila, no el del tenant activo. */
    public function test_el_conteo_de_empleados_no_se_filtra_por_la_empresa_seleccionada(): void
    {
        $companies = Company::query()->withCount([
            'employees as employees_count' => fn ($q) => $q->withoutGlobalScope(CompanyScope::class),
        ])->get();

        if ($companies->count() < 1) {
            $this->markTestSkipped('No hay empresas en la base de datos.');
        }

        $response = $this->actingAs($this->superAdmin())->get(route('companies.index'));
        $rows = collect($response->viewData('page')['props']['companies']['data'])->keyBy('id');

        foreach ($companies as $company) {
            if (! $rows->has($company->id)) {
                continue;
            }

            $this->assertSame(
                (int) $company->employees_count,
                (int) $rows[$company->id]['employees_count'],
                "El conteo de empleados de «{$company->name}» no coincide."
            );
        }
    }

    public function test_los_filtros_nuevos_de_empresas_no_revientan_y_devuelven_conteos(): void
    {
        foreach (['active', 'inactive', 'at_limit', 'expiring'] as $status) {
            $response = $this->actingAs($this->superAdmin())->get(route('companies.index', ['status' => $status]));

            $response->assertOk();
            $response->assertInertia(fn ($page) => $page->where('filters.status', $status));
        }
    }

    public function test_el_filtro_por_plan_solo_devuelve_empresas_de_ese_plan(): void
    {
        $plan = MembershipPlan::query()->whereHas('companies')->first();

        if (! $plan) {
            $this->markTestSkipped('Ningun plan tiene empresas asignadas.');
        }

        $response = $this->actingAs($this->superAdmin())->get(route('companies.index', ['plan' => $plan->slug]));

        $response->assertOk();

        foreach ($response->viewData('page')['props']['companies']['data'] as $row) {
            $this->assertSame($plan->id, $row['membership_plan']['id'] ?? null);
        }
    }

    public function test_la_exportacion_de_empresas_devuelve_un_csv(): void
    {
        $response = $this->actingAs($this->superAdmin())->get(route('companies.export'));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Empresa', $response->streamedContent());
    }

    public function test_el_permiso_de_exportar_empresas_esta_en_el_catalogo(): void
    {
        $this->assertContains('companies.index.export', PermissionHelper::flatPermissions());
        $this->assertContains('payroll_periodicities.index.reorder', PermissionHelper::flatPermissions());
        $this->assertContains('payroll_periodicities.index.toggle', PermissionHelper::flatPermissions());
    }

    public function test_reordenar_permuta_las_posiciones_sin_pisar_otras_filas(): void
    {
        $rows = PayrollPeriodicity::query()->ordered()->take(2)->get();

        if ($rows->count() < 2) {
            $this->markTestSkipped('Hacen falta dos periodicidades para reordenar.');
        }

        [$first, $second] = [$rows[0], $rows[1]];
        $slots = [$first->sort_order, $second->sort_order];

        $this->actingAs($this->superAdmin())
            ->patch(route('payroll-periodicities.reorder'), ['ids' => [$second->id, $first->id]])
            ->assertRedirect();

        $first->refresh();
        $second->refresh();

        // Las dos ocupan las mismas dos posiciones de antes, intercambiadas.
        $this->assertSame(
            collect($slots)->sort()->values()->all(),
            collect([$first->sort_order, $second->sort_order])->sort()->values()->all()
        );
        $this->assertGreaterThan($second->sort_order, $first->sort_order);
    }

    public function test_el_interruptor_del_listado_cambia_el_estado(): void
    {
        $row = PayrollPeriodicity::query()->first();

        if (! $row) {
            $this->markTestSkipped('No hay periodicidades en la base de datos.');
        }

        $original = $row->is_active;

        $this->actingAs($this->superAdmin())
            ->patch(route('payroll-periodicities.toggle', $row->id), ['is_active' => ! $original])
            ->assertRedirect();

        $this->assertSame(! $original, $row->fresh()->is_active);

        $this->actingAs($this->superAdmin())
            ->patch(route('payroll-periodicities.toggle', $row->id), ['is_active' => $original]);
    }

    public function test_el_listado_de_periodicidades_trae_el_uso_por_empresa(): void
    {
        $response = $this->actingAs($this->superAdmin())->get(route('payroll-periodicities.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('PayrollPeriodicities/Index')
            ->has('chipCounts.all')
            ->has('chipCounts.active')
            ->has('chipCounts.inactive'));

        $rows = $response->viewData('page')['props']['periodicities']['data'];

        if ($rows !== []) {
            $this->assertArrayHasKey('companies_count', $rows[0]);
            $this->assertArrayHasKey('payrolls_count', $rows[0]);
        }
    }

    public function test_el_listado_de_planes_incluye_las_caracteristicas_y_el_destacado(): void
    {
        $response = $this->actingAs($this->superAdmin())->get(route('super-admin.membership-plans.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('SuperAdmin/MembershipPlans/Index')
            ->has('featuredPlanId'));

        $rows = $response->viewData('page')['props']['plans']['data'];

        if ($rows !== []) {
            $this->assertArrayHasKey('features_json', $rows[0]);
            $this->assertArrayHasKey('companies_count', $rows[0]);
        }
    }

    public function test_mi_empresa_rechaza_deducciones_que_pasan_del_cien_por_ciento(): void
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->first();

        if (! $user) {
            $this->markTestSkipped('No hay un administrador con empresa asignada.');
        }

        $company = $user->company;

        $response = $this->actingAs($user)->put(route('settings.update'), [
            'name' => $company->name,
            'settings' => [
                'currency' => 'COP',
                'default_deductions' => [
                    ['key' => 'salud', 'label' => 'Salud', 'percent' => 60],
                    ['key' => 'pension', 'label' => 'Pension', 'percent' => 55],
                ],
            ],
        ]);

        $response->assertSessionHasErrors('settings.default_deductions');
    }

    public function test_mi_empresa_rechaza_umbrales_de_dificultad_no_crecientes(): void
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->first();

        if (! $user) {
            $this->markTestSkipped('No hay un administrador con empresa asignada.');
        }

        $response = $this->actingAs($user)->put(route('settings.update'), [
            'name' => $user->company->name,
            'settings' => [
                'currency' => 'COP',
                'difficulty_minute_thresholds' => [5, 4, 10, 20],
            ],
        ]);

        $response->assertSessionHasErrors('settings.difficulty_minute_thresholds');
    }

    public function test_una_periodicidad_nueva_se_coloca_al_final_de_la_lista(): void
    {
        $max = (int) PayrollPeriodicity::query()->max('sort_order');
        $code = 'test_orden_'.uniqid();

        $this->actingAs($this->superAdmin())
            ->post(route('payroll-periodicities.store'), [
                'code' => $code,
                'name' => 'Prueba de orden',
                'is_active' => true,
            ])
            ->assertRedirect();

        $created = PayrollPeriodicity::query()->where('code', $code)->first();

        $this->assertNotNull($created);
        $this->assertSame($max + 1, $created->sort_order);
    }
}
