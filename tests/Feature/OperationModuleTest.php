<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Operation;
use App\Models\User;
use App\Support\OperationDifficulty;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de operaciones tras el rediseno.
 *
 * Lo que se protege: que el listado siga entregando lo que la pantalla necesita (filtros
 * y metricas del catalogo, no de la pagina) y que las acciones nuevas —ficha, precio en
 * linea, duplicar y cambio de estado en bloque— hagan lo que dicen.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class OperationModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('operations.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso operations.index.view en esta base.');
        }

        return $user;
    }

    protected function editor(): User
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('operations.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar operaciones.');
        }

        return $user;
    }

    protected function someOperation(User $user): Operation
    {
        $operation = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->first();

        if ($operation === null) {
            $this->markTestSkipped('La empresa del usuario no tiene operaciones.');
        }

        return $operation;
    }

    public function test_index_returns_filters_and_catalogue_metrics(): void
    {
        $this->actingAs($this->actor())
            ->get(route('operations.index', ['status' => 'active', 'difficulty' => '1']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Operations/Index')
                ->has('operations')
                ->has('metrics.avg_price')
                ->has('metrics.avg_minutes')
                ->has('metrics.active')
                ->has('metrics.avg_difficulty_level')
                ->where('filters.status', 'active')
                ->where('filters.difficulty', '1'));
    }

    public function test_index_ignores_filters_it_does_not_understand(): void
    {
        $this->actingAs($this->actor())
            ->get(route('operations.index', ['status' => 'lo-que-sea', 'difficulty' => '99']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('filters.status', 'all')
                ->where('filters.difficulty', ''));
    }

    public function test_the_metrics_describe_the_catalogue_not_the_page(): void
    {
        $user = $this->actor();

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $expected = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->count();

        $this->actingAs($user)
            ->get(route('operations.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('metrics.active', $expected));
    }

    public function test_the_detail_screen_lists_references_and_recent_production(): void
    {
        $user = $this->actor();
        $operation = $this->someOperation($user);

        $this->actingAs($user)
            ->get(route('operations.show', $operation->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Operations/Show')
                ->where('operation.id', $operation->id)
                ->has('metrics.units_month')
                ->has('metrics.value_month')
                ->has('metrics.people_month')
                ->has('metrics.avg_daily')
                ->has('references')
                ->has('productions'));
    }

    public function test_the_form_screens_render(): void
    {
        $user = $this->actor();
        $operation = $this->someOperation($user);

        if ($user->isSuperAdmin() || $user->can('operations.index.create')) {
            $this->actingAs($user)
                ->get(route('operations.create'))
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page->component('Operations/Create'));
        }

        $this->actingAs($user)
            ->get(route('operations.edit', $operation->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Operations/Edit')
                ->where('operation.id', $operation->id)
                ->has('usage.units_month')
                ->has('usage.last_production_at'));
    }

    public function test_the_price_endpoint_changes_only_the_price(): void
    {
        $user = $this->editor();
        $operation = $this->someOperation($user);

        $before = [
            'name' => $operation->name,
            'minutes' => (string) $operation->estimated_minutes,
            'difficulty' => $operation->difficulty_level,
        ];

        $this->actingAs($user)
            ->from(route('operations.index'))
            ->patch(route('operations.price', $operation->id), ['base_price' => 1234.5])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $fresh = $operation->fresh();

        $this->assertSame('1234.50', (string) $fresh->base_price);
        // La dificultad depende de los minutos: cambiar el precio no debe moverla.
        $this->assertSame($before['name'], $fresh->name);
        $this->assertSame($before['minutes'], (string) $fresh->estimated_minutes);
        $this->assertSame($before['difficulty'], $fresh->difficulty_level);
    }

    public function test_the_price_endpoint_rejects_a_negative_value(): void
    {
        $user = $this->editor();
        $operation = $this->someOperation($user);

        $this->actingAs($user)
            ->from(route('operations.index'))
            ->patch(route('operations.price', $operation->id), ['base_price' => -5])
            ->assertSessionHasErrors('base_price');
    }

    public function test_duplicating_creates_a_copy_and_opens_it_for_editing(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('operations.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear operaciones.');
        }

        $operation = $this->someOperation($user);

        $response = $this->actingAs($user)->post(route('operations.duplicate', $operation->id));

        $copy = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $operation->company_id)
            ->where('name', 'like', $operation->name.' (copia%')
            ->latest('id')
            ->first();

        $this->assertNotNull($copy, 'No se creo la copia.');
        $response->assertRedirect(route('operations.edit', $copy->id));

        $this->assertSame((string) $operation->base_price, (string) $copy->base_price);
        $this->assertSame((string) $operation->estimated_minutes, (string) $copy->estimated_minutes);
        $this->assertTrue($copy->is_active);
        // La copia no hereda los vinculos con referencias: esos precios son de cada prenda.
        $this->assertSame(0, $copy->references()->count());
    }

    public function test_bulk_status_updates_every_selected_operation(): void
    {
        $user = $this->editor();

        $ids = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->limit(3)
            ->pluck('id');

        if ($ids->count() < 2) {
            $this->markTestSkipped('Hacen falta al menos dos operaciones para probar el bloque.');
        }

        $this->actingAs($user)
            ->from(route('operations.index'))
            ->post(route('operations.bulk-status'), ['ids' => $ids->all(), 'is_active' => false])
            ->assertSessionHas('success');

        $stillActive = Operation::query()->withoutGlobalScopes()->whereIn('id', $ids)->where('is_active', true)->count();
        $this->assertSame(0, $stillActive);

        $this->actingAs($user)
            ->from(route('operations.index'))
            ->post(route('operations.bulk-status'), ['ids' => $ids->all(), 'is_active' => true])
            ->assertSessionHas('success');

        $inactive = Operation::query()->withoutGlobalScopes()->whereIn('id', $ids)->where('is_active', false)->count();
        $this->assertSame(0, $inactive);
    }

    public function test_bulk_status_requires_a_selection(): void
    {
        $this->actingAs($this->editor())
            ->from(route('operations.index'))
            ->post(route('operations.bulk-status'), ['ids' => [], 'is_active' => true])
            ->assertSessionHasErrors('ids');
    }

    public function test_bulk_status_refuses_operations_from_another_company(): void
    {
        $user = $this->editor();

        $foreign = Operation::query()->withoutGlobalScopes()
            ->where('company_id', '!=', $user->company_id)
            ->first();

        if ($foreign === null || $user->isSuperAdmin()) {
            $this->markTestSkipped('No hay operaciones de otra empresa con las que probarlo.');
        }

        $this->actingAs($user)
            ->from(route('operations.index'))
            ->post(route('operations.bulk-status'), ['ids' => [$foreign->id], 'is_active' => false])
            ->assertSessionHasErrors('ids');

        $this->assertSame($foreign->is_active, $foreign->fresh()->is_active);
    }

    public function test_the_quick_create_endpoint_still_answers_json(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('operations.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear operaciones.');
        }

        // El modal de la referencia depende de esta respuesta para seleccionar la operacion.
        $response = $this->actingAs($user)
            ->postJson(route('operations.store'), [
                'name' => 'Prueba rediseño '.random_int(1000, 9999),
                'base_price' => 500,
                'estimated_minutes' => 9.5,
                'description' => null,
                'is_active' => true,
            ]);

        $response->assertOk()
            ->assertJsonStructure(['id', 'name', 'base_price', 'estimated_minutes', 'difficulty_level', 'is_active']);

        // La dificultad sale de los cortes de la empresa, que son configurables: se compara
        // contra la misma regla del backend en vez de contra un numero escrito a mano.
        $thresholds = OperationDifficulty::thresholdsFor(Company::find($user->company_id));
        $expected = OperationDifficulty::levelFromMinutes(9.5, $thresholds);

        $this->assertSame($expected, $response->json('difficulty_level'));
    }
}
