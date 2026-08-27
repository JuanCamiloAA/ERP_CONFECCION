<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\DashboardWidget;
use App\Models\DashboardWidgetVisibility;
use App\Models\User;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use App\Services\DashboardBuilder\WidgetQueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Constructor de dashboards tras el rediseno.
 *
 * Lo que se protege: que el listado diga de donde sale el dato y quien lo ve sin abrir el
 * editor, que el interruptor y el duplicado funcionen de verdad, que el SQL que muestra el
 * editor sea el mismo que se ejecuta —y que exponerlo no ejecute nada—, y que guardar el
 * widget y guardar la visibilidad sigan siendo dos peticiones distintas.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class DashboardBuilderTest extends TestCase
{
    use DatabaseTransactions;

    protected function superAdmin(): User
    {
        $user = User::query()->get()->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay super admin en esta base.');
        }

        return $user;
    }

    protected function someWidget(): DashboardWidget
    {
        $widget = DashboardWidget::query()->first();

        if ($widget === null) {
            $this->markTestSkipped('No hay widgets registrados en esta base.');
        }

        return $widget;
    }

    /** Definicion guiada valida contra el catalogo real, para las pruebas del SQL. */
    protected function guidedDefinition(): array
    {
        return [
            'table' => 'productions',
            'metric' => ['column' => 'total_value', 'aggregation' => 'sum'],
            'filters' => [
                ['column' => 'status', 'operator' => '=', 'value_type' => 'literal', 'value' => 'confirmada'],
                ['column' => 'employee_id', 'operator' => '=', 'value_type' => 'variable', 'value' => 'current_employee_id'],
            ],
        ];
    }

    public function test_index_exposes_the_data_source_the_audience_and_the_metrics(): void
    {
        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('SuperAdmin/DashboardWidgets/Index')
                ->has('widgets.data.0.query_summary')
                ->has('widgets.data.0.assignments')
                ->has('widgets.data.0.visibility_count')
                ->has('widgets.data.0.refresh_interval_seconds')
                ->has('companies')
                ->has('metrics.active')
                ->has('metrics.total')
                ->has('metrics.assignments')
                ->has('metrics.companies')
                ->has('metrics.roles')
                ->has('metrics.unassigned')
                ->where('filters.state', 'all'));
    }

    public function test_the_state_filter_separates_active_from_inactive(): void
    {
        $active = DashboardWidget::query()->where('is_active', true)->count();
        $inactive = DashboardWidget::query()->where('is_active', false)->count();

        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.index', ['state' => 'active']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('widgets.total', $active));

        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.index', ['state' => 'inactive']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('widgets.total', $inactive));
    }

    public function test_the_unassigned_filter_only_returns_widgets_nobody_sees(): void
    {
        $expected = DashboardWidget::query()->doesntHave('visibility')->count();

        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.index', ['state' => 'all', 'assignment' => 'none']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('widgets.total', $expected));
    }

    public function test_toggle_active_flips_the_state_without_touching_visibility(): void
    {
        $widget = $this->someWidget();
        $before = (bool) $widget->is_active;
        $assignments = $widget->visibility()->count();

        $this->actingAs($this->superAdmin())
            ->from(route('super-admin.dashboard-widgets.index'))
            ->patch(route('super-admin.dashboard-widgets.toggle-active', $widget->id))
            ->assertRedirect();

        $widget->refresh();

        $this->assertSame(! $before, (bool) $widget->is_active);
        $this->assertSame($assignments, $widget->visibility()->count());
    }

    public function test_duplicate_copies_the_definition_but_never_the_audience(): void
    {
        $widget = $this->someWidget();
        $widget->visibility()->firstOrCreate(
            ['company_id' => Company::query()->value('id'), 'role_id' => null],
            ['position' => 0],
        );

        $this->actingAs($this->superAdmin())
            ->post(route('super-admin.dashboard-widgets.duplicate', $widget->id))
            ->assertRedirect();

        $copy = DashboardWidget::query()->where('name', 'like', $widget->name.'_copia%')->latest('id')->first();

        $this->assertNotNull($copy, 'No se creo la copia del widget.');
        $this->assertSame($widget->type, $copy->type);
        $this->assertSame($widget->query_mode, $copy->query_mode);
        $this->assertSame($widget->raw_sql, $copy->raw_sql);
        $this->assertEquals($widget->query_definition, $copy->query_definition);
        $this->assertEquals($widget->chart_config, $copy->chart_config);
        // Nace apagada y sin publico: duplicar es el punto de partida de una variante.
        $this->assertFalse((bool) $copy->is_active);
        $this->assertSame(0, $copy->visibility()->count());
    }

    public function test_the_visibility_screen_renders_with_companies_and_roles(): void
    {
        $widget = $this->someWidget();

        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.visibility', $widget->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('SuperAdmin/DashboardWidgets/Visibility')
                ->has('companies')
                ->has('rolesByCompany')
                ->has('visibility')
                ->has('assignments')
                ->has('querySummary')
                ->has('availableTables'));
    }

    public function test_saving_visibility_replaces_the_rows_with_their_position(): void
    {
        $widget = $this->someWidget();
        $companyId = (int) Company::query()->value('id');

        $this->actingAs($this->superAdmin())
            ->put(route('super-admin.dashboard-widgets.visibility.update', $widget->id), [
                'visibility' => [
                    ['company_id' => $companyId, 'role_id' => null, 'position' => 0],
                ],
            ])
            ->assertRedirect();

        $rows = DashboardWidgetVisibility::query()->where('dashboard_widget_id', $widget->id)->get();

        $this->assertCount(1, $rows);
        $this->assertSame($companyId, (int) $rows->first()->company_id);
        $this->assertNull($rows->first()->role_id);
        $this->assertSame(0, (int) $rows->first()->position);
    }

    public function test_the_editor_receives_the_generated_sql_of_a_guided_widget(): void
    {
        $widget = DashboardWidget::query()->where('query_mode', DashboardWidget::QUERY_MODE_BUILDER)->first();

        if ($widget === null) {
            $this->markTestSkipped('No hay widgets en modo guiado en esta base.');
        }

        $this->actingAs($this->superAdmin())
            ->get(route('super-admin.dashboard-widgets.edit', $widget->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('SuperAdmin/DashboardWidgets/Edit')
                ->has('generatedSql')
                ->has('assignments')
                ->has('visibilityCount'));
    }

    public function test_generated_sql_keeps_the_placeholders_and_never_executes(): void
    {
        $builder = app(WidgetQueryBuilder::class);

        // Si ejecutara algo, el listener registraria la consulta.
        $executed = 0;
        DB::listen(function () use (&$executed) {
            $executed++;
        });

        $sql = $builder->generatedSql($this->guidedDefinition(), DashboardWidget::TYPE_KPI);

        $this->assertSame(0, $executed, 'generatedSql() no debe ejecutar consultas.');
        $this->assertStringContainsString('SUM(`total_value`) as agg_value', $sql);
        $this->assertStringContainsString('`company_id` = :company_id', $sql);
        $this->assertStringContainsString(':current_employee_id', $sql);
        // El filtro literal viaja interpolado, no como `?`.
        $this->assertStringContainsString("'confirmada'", $sql);
        $this->assertStringNotContainsString('?', $sql);
    }

    public function test_generated_sql_of_a_grouped_widget_includes_the_group_expression(): void
    {
        $definition = $this->guidedDefinition();
        $definition['group_by'] = ['column' => 'date', 'granularity' => 'month'];

        $sql = app(WidgetQueryBuilder::class)->generatedSql($definition, DashboardWidget::TYPE_BAR);

        $this->assertStringContainsString("DATE_FORMAT(`date`, '%Y-%m-01') as group_label", $sql);
        $this->assertStringContainsString('group by `group_label`', strtolower($sql));
    }

    public function test_generated_sql_rejects_a_table_outside_the_whitelist(): void
    {
        $this->expectException(WidgetQueryException::class);

        app(WidgetQueryBuilder::class)->generatedSql(['table' => 'users'], DashboardWidget::TYPE_KPI);
    }

    public function test_the_guided_query_still_executes_after_the_refactor(): void
    {
        $companyId = (int) Company::query()->value('id');
        $builder = app(WidgetQueryBuilder::class);

        $kpi = $builder->executeGuided(
            ['table' => 'productions', 'metric' => ['column' => 'total_value', 'aggregation' => 'sum']],
            $companyId,
            DashboardWidget::TYPE_KPI,
        );
        $this->assertArrayHasKey('value', $kpi);

        $series = $builder->executeGuided(
            [
                'table' => 'productions',
                'metric' => ['column' => 'total_value', 'aggregation' => 'sum'],
                'group_by' => ['column' => 'date', 'granularity' => 'month'],
            ],
            $companyId,
            DashboardWidget::TYPE_BAR,
        );
        $this->assertArrayHasKey('labels', $series);
        $this->assertArrayHasKey('series', $series);
        $this->assertSameSize($series['labels'], $series['series']);

        $table = $builder->executeGuided(
            ['table' => 'productions', 'columns' => ['date', 'quantity'], 'limit' => 5],
            $companyId,
            DashboardWidget::TYPE_TABLE,
        );
        $this->assertSame(['date', 'quantity'], $table['columns']);
        $this->assertLessThanOrEqual(5, count($table['rows']));
    }

    public function test_preview_returns_the_execution_metadata(): void
    {
        $response = $this->actingAs($this->superAdmin())
            ->postJson(route('super-admin.dashboard-widgets.preview'), [
                'type' => DashboardWidget::TYPE_KPI,
                'query_mode' => DashboardWidget::QUERY_MODE_BUILDER,
                'query_definition' => [
                    'table' => 'productions',
                    'metric' => ['column' => 'total_value', 'aggregation' => 'sum'],
                ],
            ]);

        // Sin empresa enfocada en el selector, la tabla con company_id devuelve 422 con
        // mensaje claro; con empresa, devuelve el valor y su metadata.
        if ($response->status() === 422) {
            $response->assertJsonStructure(['message']);

            return;
        }

        $response->assertOk()->assertJsonStructure([
            'value',
            'meta' => ['rows', 'duration_ms', 'company_label', 'generated_sql'],
        ]);
    }

    public function test_a_company_user_cannot_reach_the_builder(): void
    {
        $user = User::query()->whereNotNull('company_id')->get()->first(fn (User $u) => ! $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuarios de empresa en esta base.');
        }

        $this->actingAs($user)
            ->get(route('super-admin.dashboard-widgets.index'))
            ->assertForbidden();
    }
}
