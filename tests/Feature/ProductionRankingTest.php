<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\ProductionRankingTeamFilter;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Ranking de produccion: filtro de equipo y los cuatro permisos que lo gobiernan.
 *
 * Lo que se protege es la lista de aceptacion del rediseno: quien ve las metricas, quien
 * exporta, quien fija el rango de todos y quien puede desviarse de el. Y que la pantalla
 * siga entregando los props que necesita.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class ProductionRankingTest extends TestCase
{
    use DatabaseTransactions;

    protected const ALL_RANKING_PERMISSIONS = [
        'productions.ranking.view',
        'productions.ranking.stats.view',
        'productions.ranking.export',
        'productions.ranking.filter_team.manage',
        'productions.ranking.filter_own.manage',
    ];

    /**
     * Un usuario de empresa con exactamente los permisos que pide la prueba.
     *
     * Se reasignan de cero porque el permiso efectivo es lo que el usuario tiene asignado,
     * no lo que su rol conceda: dejarle los suyos taparia justo lo que se quiere medir.
     *
     * @param  list<string>  $permissions
     */
    protected function actorWith(array $permissions): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => ! $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuarios de empresa en esta base.');
        }

        app(UserPermissionService::class)->sync($user, $permissions, $user);

        return $user->refresh();
    }

    protected function pinTeamFilter(User $user, string $start, string $end): ProductionRankingTeamFilter
    {
        return ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)->updateOrCreate(
            ['company_id' => $user->company_id],
            ['date_start' => $start, 'date_end' => $end, 'set_by_user_id' => $user->id],
        );
    }

    /** Quincena en curso, la misma cuenta que hace el controlador. */
    protected function currentFortnight(): array
    {
        $today = now();

        return $today->day <= 15
            ? [$today->copy()->startOfMonth()->toDateString(), $today->copy()->startOfMonth()->addDays(14)->toDateString()]
            : [$today->copy()->startOfMonth()->addDays(15)->toDateString(), $today->copy()->endOfMonth()->toDateString()];
    }

    public function test_sin_filtro_de_equipo_el_rango_por_defecto_es_la_quincena_en_curso(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->delete();

        [$start, $end] = $this->currentFortnight();

        $this->actingAs($user)
            ->get(route('productions.ranking'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Ranking')
                ->where('filters.start', $start)
                ->where('filters.end', $end)
                ->where('teamFilter', null)
                ->has('ranking')
                ->has('references')
                ->has('previousPeriod.start')
                ->has('previousPeriod.end'));
    }

    public function test_el_filtro_de_equipo_es_el_rango_inicial_de_quien_abre_la_pestana(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);
        $this->pinTeamFilter($user, '2026-01-05', '2026-01-19');

        $this->actingAs($user)
            ->get(route('productions.ranking'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('filters.start', '2026-01-05')
                ->where('filters.end', '2026-01-19')
                ->where('teamFilter.date_start', '2026-01-05')
                ->where('teamFilter.date_end', '2026-01-19')
                ->has('teamFilter.set_by'));
    }

    public function test_quien_puede_ajustar_su_filtro_se_desvia_del_de_equipo(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);
        $this->pinTeamFilter($user, '2026-01-05', '2026-01-19');

        $this->actingAs($user)
            ->get(route('productions.ranking', ['start' => '2026-02-01', 'end' => '2026-02-15', 'shift' => 'manana']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('filters.start', '2026-02-01')
                ->where('filters.end', '2026-02-15')
                ->where('filters.shift', 'manana')
                // El banner sigue diciendo lo que fijo la empresa, aunque no sea lo que ve.
                ->where('teamFilter.date_start', '2026-01-05'));
    }

    public function test_sin_permiso_de_filtro_propio_la_url_no_manda(): void
    {
        $user = $this->actorWith(['productions.ranking.view']);
        $this->pinTeamFilter($user, '2026-01-05', '2026-01-19');

        $this->actingAs($user)
            ->get(route('productions.ranking', [
                'start' => '2026-02-01',
                'end' => '2026-02-15',
                'shift' => 'noche',
                'only_confirmed' => 1,
            ]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('filters.start', '2026-01-05')
                ->where('filters.end', '2026-01-19')
                ->where('filters.shift', null)
                ->where('filters.only_confirmed', false));
    }

    public function test_sin_filtro_de_equipo_ni_permiso_propio_queda_el_rango_por_defecto(): void
    {
        $user = $this->actorWith(['productions.ranking.view']);

        ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->delete();

        [$start, $end] = $this->currentFortnight();

        $this->actingAs($user)
            ->get(route('productions.ranking', ['start' => '2026-02-01', 'end' => '2026-02-15']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('filters.start', $start)
                ->where('filters.end', $end));
    }

    public function test_fijar_el_filtro_de_equipo_exige_su_permiso(): void
    {
        $user = $this->actorWith(['productions.ranking.view', 'productions.ranking.filter_own.manage']);

        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->post(route('productions.ranking.team-filter.store'), [
                'date_start' => '2026-03-01',
                'date_end' => '2026-03-15',
            ])
            ->assertForbidden();

        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->delete(route('productions.ranking.team-filter.destroy'))
            ->assertForbidden();
    }

    public function test_fijar_y_quitar_el_filtro_deja_una_sola_fila_por_empresa(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->post(route('productions.ranking.team-filter.store'), [
                'date_start' => '2026-03-01',
                'date_end' => '2026-03-15',
            ])
            ->assertSessionHas('success');

        // Cambiarlo no crea otra fila: es uno por empresa.
        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->post(route('productions.ranking.team-filter.store'), [
                'date_start' => '2026-03-16',
                'date_end' => '2026-03-31',
            ])
            ->assertSessionHas('success');

        $this->assertSame(
            1,
            ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $user->company_id)
                ->count(),
        );

        $this->assertDatabaseHas('production_ranking_team_filters', [
            'company_id' => $user->company_id,
            'date_start' => '2026-03-16',
            'date_end' => '2026-03-31',
            'set_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->delete(route('productions.ranking.team-filter.destroy'))
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('production_ranking_team_filters', [
            'company_id' => $user->company_id,
        ]);
    }

    public function test_el_filtro_de_equipo_no_acepta_un_rango_al_reves(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        $this->actingAs($user)
            ->from(route('productions.ranking'))
            ->post(route('productions.ranking.team-filter.store'), [
                'date_start' => '2026-03-20',
                'date_end' => '2026-03-01',
            ])
            ->assertSessionHasErrors('date_end');
    }

    public function test_el_filtro_de_equipo_de_una_empresa_no_alcanza_a_otra(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        $otherCompany = Company::query()->where('id', '!=', $user->company_id)->first();

        if ($otherCompany === null) {
            $this->markTestSkipped('Solo hay una empresa en esta base.');
        }

        $this->pinTeamFilter($user, '2026-01-05', '2026-01-19');

        ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $otherCompany->id)
            ->delete();

        $this->assertSame(
            0,
            ProductionRankingTeamFilter::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $otherCompany->id)
                ->count(),
        );
    }

    public function test_exportar_el_ranking_exige_su_permiso(): void
    {
        $sin = $this->actorWith(['productions.ranking.view', 'productions.ranking.filter_own.manage']);

        $this->actingAs($sin)
            ->get(route('productions.ranking.export'))
            ->assertForbidden();

        $con = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        $this->actingAs($con)
            ->get(route('productions.ranking.export'))
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_cada_fila_trae_su_variacion_contra_el_periodo_anterior(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        $response = $this->actingAs($user)->get(route('productions.ranking'));
        $response->assertOk();

        $props = $response->viewData('page')['props'];

        $this->assertArrayHasKey('previousPeriod', $props);

        // El periodo anterior tiene los mismos dias y termina la vispera del actual.
        $start = \Illuminate\Support\Carbon::parse($props['filters']['start']);
        $end = \Illuminate\Support\Carbon::parse($props['filters']['end']);
        $previousStart = \Illuminate\Support\Carbon::parse($props['previousPeriod']['start']);
        $previousEnd = \Illuminate\Support\Carbon::parse($props['previousPeriod']['end']);

        $this->assertSame($start->copy()->subDay()->toDateString(), $previousEnd->toDateString());
        $this->assertSame($start->diffInDays($end), $previousStart->diffInDays($previousEnd));

        foreach ($props['ranking'] as $row) {
            $this->assertArrayHasKey('previous_points', $row);
            $this->assertArrayHasKey('change_percent', $row);
        }
    }

    public function test_una_referencia_de_otra_empresa_no_filtra_el_ranking(): void
    {
        $user = $this->actorWith(self::ALL_RANKING_PERMISSIONS);

        // Un id que no existe en su catalogo se descarta en lugar de vaciar la pantalla.
        $this->actingAs($user)
            ->get(route('productions.ranking', ['reference_id' => 999999]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.reference_id', null));
    }

    public function test_el_ranking_sigue_exigiendo_el_permiso_de_ver(): void
    {
        $user = $this->actorWith(['dashboard.index.view']);

        $this->actingAs($user)
            ->get(route('productions.ranking'))
            ->assertForbidden();
    }
}
