<?php

namespace Tests\Feature;

use App\Models\Production;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de produccion tras el rediseno del listado.
 *
 * Se protegen las dos cosas que el rediseno podia romper: que los parametros que viajan
 * al listado sigan siendo los mismos siete, y que las acciones nuevas —confirmar uno,
 * confirmar el dia y exportar— hagan lo que dicen.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class ProductionModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            // El operario ya no tiene listado en «Mi producción»: lo suyo esta en el Detalle
            // y el Historial, que se prueban con `worker()`.
            ->first(fn (User $u) => ($u->isSuperAdmin() || $u->can('productions.index.view'))
                && ! $u->isRestrictedProductionAccount());

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso productions.index.view en esta base.');
        }

        return $user;
    }

    protected function worker(): User
    {
        $worker = User::query()
            ->whereNotNull('employee_id')
            ->get()
            ->first(fn (User $u) => $u->isRestrictedProductionAccount() && $u->can('productions.index.view'));

        if ($worker === null) {
            $this->markTestSkipped('No hay cuenta de produccion restringida en esta base.');
        }

        return $worker;
    }

    protected function someProduction(User $user): Production
    {
        $production = Production::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->first();

        if ($production === null) {
            $this->markTestSkipped('La empresa del usuario no tiene registros de produccion.');
        }

        return $production;
    }

    public function test_index_keeps_the_seven_filters_and_adds_the_pending_count(): void
    {
        $this->actingAs($this->actor())
            ->get(route('productions.index', ['shift' => 'manana', 'status' => 'pendiente']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Index')
                ->has('productions')
                ->has('totals.total_quantity')
                ->has('totals.total_value')
                ->has('totals.pending_count')
                ->has('filters.employee_id')
                ->has('filters.reference_id')
                ->has('filters.operation_id')
                ->has('filters.date_start')
                ->has('filters.date_end')
                ->where('filters.shift', 'manana')
                ->where('filters.status', 'pendiente'));
    }

    public function test_pending_count_matches_the_filter_not_the_page(): void
    {
        $user = $this->actor();

        $response = $this->actingAs($user)->get(route('productions.index', ['status' => 'pendiente']));
        $response->assertOk();

        $expected = Production::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('status', Production::STATUS_PENDING)
            ->count();

        // Con el usuario restringido el listado solo ve lo suyo; ahi la comparacion global
        // no aplica y la prueba pierde sentido.
        if ($user->isRestrictedProductionAccount()) {
            $this->markTestSkipped('El usuario de prueba es una cuenta de produccion restringida.');
        }

        $response->assertInertia(fn (AssertableInertia $page) => $page->where('totals.pending_count', $expected));
    }

    public function test_confirm_moves_a_pending_record_to_confirmed(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        $production = $this->someProduction($user);
        $production->forceFill(['status' => Production::STATUS_PENDING])->save();

        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm', $production->id))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('productions', [
            'id' => $production->id,
            'status' => Production::STATUS_CONFIRMED,
        ]);
    }

    public function test_confirm_says_so_when_the_record_was_already_confirmed(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        $production = $this->someProduction($user);
        $production->forceFill(['status' => Production::STATUS_CONFIRMED])->save();

        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm', $production->id))
            ->assertSessionHas('warning');
    }

    public function test_confirm_refuses_a_paid_record(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        $production = $this->someProduction($user);
        $production->forceFill(['status' => Production::STATUS_PAID])->save();

        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm', $production->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('productions', [
            'id' => $production->id,
            'status' => Production::STATUS_PAID,
        ]);
    }

    public function test_confirm_day_confirms_every_pending_record_of_that_date(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        $production = $this->someProduction($user);
        $date = $production->date->format('Y-m-d');

        // Todo lo de ese dia queda pendiente para poder medir el efecto del lote.
        Production::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereDate('date', $date)
            ->update(['status' => Production::STATUS_PENDING]);

        $expected = Production::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereDate('date', $date)
            ->count();

        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm-day'), ['date' => $date])
            ->assertSessionHas('success');

        $stillPending = Production::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereDate('date', $date)
            ->where('status', Production::STATUS_PENDING)
            ->count();

        $this->assertGreaterThan(0, $expected);
        $this->assertSame(0, $stillPending);
    }

    public function test_confirm_day_warns_when_there_was_nothing_pending(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        // Una fecha sin produccion: no hay nada que confirmar y hay que decirlo.
        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm-day'), ['date' => '2001-01-01'])
            ->assertSessionHas('warning');
    }

    public function test_confirm_day_requires_a_date(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('productions.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar produccion.');
        }

        $this->actingAs($user)
            ->from(route('productions.index'))
            ->post(route('productions.confirm-day'), [])
            ->assertSessionHasErrors('date');
    }

    public function test_export_streams_a_csv_with_the_same_filter(): void
    {
        $user = $this->actor();

        $response = $this->actingAs($user)->get(route('productions.export', ['shift' => 'manana']));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment; filename=', (string) $response->headers->get('content-disposition'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Fecha', $csv);
        $this->assertStringContainsString('Empleado', $csv);
        $this->assertStringContainsString('Valor', $csv);
    }

    public function test_a_restricted_production_account_cannot_confirm(): void
    {
        $worker = User::query()
            ->whereNotNull('employee_id')
            ->get()
            ->first(fn (User $u) => $u->isRestrictedProductionAccount());

        if ($worker === null) {
            $this->markTestSkipped('No hay cuenta de produccion restringida en esta base.');
        }

        $production = Production::query()->withoutGlobalScopes()
            ->where('employee_id', $worker->employee_id)
            ->first();

        if ($production === null) {
            $this->markTestSkipped('Esa cuenta no tiene produccion registrada.');
        }

        $this->actingAs($worker)
            ->post(route('productions.confirm', $production->id))
            ->assertForbidden();
    }

    public function test_the_worker_screen_registers_but_no_longer_lists(): void
    {
        $worker = $this->worker();

        $this->actingAs($worker)
            ->get(route('productions.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Index')
                ->where('workerMode', true)
                ->missing('productions')
                ->has('paymentSummary.unpaid_count')
                ->has('paymentSummary.unpaid_value')
                ->has('paymentSummary.pending_count')
                ->has('paymentSummary.paid_count')
                ->has('paymentSummary.paid_value'));
    }

    public function test_the_payment_summary_counts_only_the_worker_own_records(): void
    {
        $worker = $this->worker();

        $own = Production::query()->withoutGlobalScopes()
            ->where('company_id', $worker->company_id)
            ->where('employee_id', $worker->employee_id);

        $this->actingAs($worker)
            ->get(route('productions.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('paymentSummary.unpaid_count', (clone $own)->whereIn('status', Production::PAYABLE_STATUSES)->count())
                ->where('paymentSummary.paid_count', (clone $own)->where('status', Production::STATUS_PAID)->count()));
    }

    public function test_detail_lists_only_what_is_not_paid_yet(): void
    {
        $user = $this->actor();

        $this->actingAs($user)
            ->get(route('productions.detail'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Records')
                ->where('scope', 'unpaid')
                ->has('productions.data')
                ->where('productions.data', fn ($rows) => collect($rows)
                    ->every(fn ($row) => in_array($row['status'], Production::PAYABLE_STATUSES, true))));
    }

    public function test_history_lists_only_what_was_paid(): void
    {
        $user = $this->actor();

        $this->actingAs($user)
            ->get(route('productions.history'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Records')
                ->where('scope', 'paid')
                ->where('totals.pending_count', 0)
                ->where('productions.data', fn ($rows) => collect($rows)
                    ->every(fn ($row) => $row['status'] === Production::STATUS_PAID)));
    }

    public function test_the_worker_detail_shows_only_their_own_records(): void
    {
        $worker = $this->worker();

        $this->actingAs($worker)
            ->get(route('productions.detail'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('workerMode', true)
                ->where('productions.data', fn ($rows) => collect($rows)
                    ->every(fn ($row) => (int) $row['employee_id'] === (int) $worker->employee_id)));
    }

    public function test_detail_and_history_require_their_own_permission(): void
    {
        foreach (['productions.detail' => 'productions.detail.view', 'productions.history' => 'productions.history.view'] as $name => $permission) {
            $route = app('router')->getRoutes()->getByName($name);

            $this->assertNotNull($route, "No existe la ruta {$name}.");
            $this->assertContains('permission:'.$permission, $route->gatherMiddleware(), "La ruta {$name} no exige {$permission}.");
        }
    }
}
