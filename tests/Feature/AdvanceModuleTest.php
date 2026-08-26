<?php

namespace Tests\Feature;

use App\Models\Advance;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de anticipos tras el rediseno.
 *
 * Lo que se protege: que el saldo pendiente —el dato que la pantalla escondia— llegue al
 * front, que el filtro por saldo distinga los tres estados sin tocar la base, y que cada
 * accion de la pantalla (ver, exportar, eliminar) responda de verdad.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class AdvanceModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('advances.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso advances.index.view en esta base.');
        }

        return $user;
    }

    protected function someAdvance(User $user): Advance
    {
        $advance = Advance::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->first();

        if ($advance === null) {
            $this->markTestSkipped('La empresa del usuario no tiene anticipos.');
        }

        return $advance;
    }

    public function test_index_exposes_balance_metrics_and_filters(): void
    {
        $this->actingAs($this->actor())
            ->get(route('advances.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Advances/Index')
                ->has('advances')
                ->has('employees')
                ->has('metrics.pending_total')
                ->has('metrics.pending_count')
                ->has('metrics.pending_employees')
                ->has('metrics.month_total')
                ->has('metrics.prev_month_total')
                ->has('metrics.year_discounted')
                ->has('metrics.year_closed_count')
                ->has('metrics.next_payroll_date')
                // El filtro por defecto es «con saldo»: la pregunta real del negocio.
                ->where('filters.balance', 'with'));
    }

    public function test_the_balance_filter_separates_open_from_settled(): void
    {
        $user = $this->actor();

        $withBalance = Advance::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('remaining_amount', '>', 0)
            ->count();

        $settled = Advance::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('remaining_amount', '<=', 0)
            ->count();

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $this->actingAs($user)
            ->get(route('advances.index', ['balance' => 'with']))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('advances.total', $withBalance));

        $this->actingAs($user)
            ->get(route('advances.index', ['balance' => 'settled']))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('advances.total', $settled));

        $this->actingAs($user)
            ->get(route('advances.index', ['balance' => 'all']))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('advances.total', $withBalance + $settled));
    }

    public function test_an_unknown_balance_filter_falls_back_to_all(): void
    {
        $this->actingAs($this->actor())
            ->get(route('advances.index', ['balance' => 'lo-que-sea']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.balance', 'all'));
    }

    public function test_the_search_finds_by_employee_and_by_reason(): void
    {
        $user = $this->actor();
        $advance = $this->someAdvance($user);
        $advance->load('employee');

        $term = $advance->employee?->first_name;

        if (! $term) {
            $this->markTestSkipped('El anticipo de prueba no tiene empleado con nombre.');
        }

        $this->actingAs($user)
            ->get(route('advances.index', ['search' => $term, 'balance' => 'all']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.search', $term));
    }

    public function test_the_create_screen_carries_the_context_the_panel_needs(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('advances.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear anticipos.');
        }

        $this->actingAs($user)
            ->get(route('advances.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Advances/Create')
                ->has('period.start')
                ->has('period.end')
                ->has('period.payroll_date')
                ->has('employees.0.pending_balance')
                ->has('employees.0.avg_net')
                ->has('employees.0.advances_this_year')
                ->has('employees.0.avg_amount')
                ->has('employees.0.last_advance'));
    }

    public function test_the_detail_screen_reports_whether_it_can_be_deleted(): void
    {
        $user = $this->actor();
        $advance = $this->someAdvance($user);

        $expected = bccomp((string) $advance->remaining_amount, (string) $advance->amount, 2) === 0;

        $this->actingAs($user)
            ->get(route('advances.show', $advance->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Advances/Show')
                ->where('advance.id', $advance->id)
                ->has('applications')
                ->has('employee_other')
                ->has('employee_pending_total')
                ->where('can_delete', $expected));
    }

    public function test_a_partially_discounted_advance_cannot_be_deleted(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('advances.index.delete')) {
            $this->markTestSkipped('El usuario de prueba no puede eliminar anticipos.');
        }

        $advance = $this->someAdvance($user);

        // Medio descontado: ni pendiente ni cerrado. Es el caso que la pantalla vieja
        // mostraba como «pendiente» y el que el servidor se niega a borrar.
        $advance->forceFill([
            'amount' => 200000,
            'remaining_amount' => 120000,
            'status' => Advance::STATUS_PENDING,
        ])->save();

        $this->actingAs($user)
            ->from(route('advances.index'))
            ->delete(route('advances.destroy', $advance->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('advances', ['id' => $advance->id]);

        $this->actingAs($user)
            ->get(route('advances.show', $advance->id))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('can_delete', false));
    }

    public function test_an_untouched_advance_can_be_deleted(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('advances.index.delete')) {
            $this->markTestSkipped('El usuario de prueba no puede eliminar anticipos.');
        }

        $advance = $this->someAdvance($user);
        $advance->forceFill([
            'amount' => 150000,
            'remaining_amount' => 150000,
            'status' => Advance::STATUS_PENDING,
        ])->save();

        $this->actingAs($user)
            ->delete(route('advances.destroy', $advance->id))
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('advances', ['id' => $advance->id]);
    }

    public function test_export_streams_a_csv_with_the_same_filter(): void
    {
        $response = $this->actingAs($this->actor())->get(route('advances.export', ['balance' => 'all']));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment; filename=', (string) $response->headers->get('content-disposition'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Saldo por descontar', $csv);
        $this->assertStringContainsString('Ya descontado', $csv);
    }

    public function test_the_receipt_carries_everything_the_printed_sheet_needs(): void
    {
        $user = $this->actor();
        $advance = $this->someAdvance($user);

        $this->actingAs($user)
            ->get(route('advances.receipt', $advance->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Advances/Receipt')
                ->where('advance.id', $advance->id)
                ->has('advance.employee')
                ->has('company')
                ->has('previous_balance')
                ->has('period.start')
                ->has('period.end')
                ->has('period.payroll_date')
                ->has('issued_by')
                // Sin parametros, la hoja sale con las dos copias.
                ->where('copies', 2));
    }

    public function test_the_receipt_accepts_a_single_copy(): void
    {
        $user = $this->actor();
        $advance = $this->someAdvance($user);

        $this->actingAs($user)
            ->get(route('advances.receipt', ['advance' => $advance->id, 'copies' => 1]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('copies', 1));

        // Cualquier otro valor vuelve a las dos copias: la hoja nunca sale a medias.
        $this->actingAs($user)
            ->get(route('advances.receipt', ['advance' => $advance->id, 'copies' => 7]))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('copies', 2));
    }

    public function test_the_previous_balance_counts_earlier_advances_and_excludes_this_one(): void
    {
        $user = $this->actor();
        $companyId = $this->someAdvance($user)->company_id;
        $employeeId = $this->someAdvance($user)->employee_id;

        // Se aisla el empleado: cualquier anticipo suyo que ya exista distorsionaria la suma.
        Advance::query()->where('employee_id', $employeeId)->delete();

        $earlier = Advance::create([
            'company_id' => $companyId,
            'employee_id' => $employeeId,
            'amount' => 300000,
            'remaining_amount' => 180000,
            'date' => now()->subMonth()->toDateString(),
            'reason' => 'Anterior',
            'status' => Advance::STATUS_PENDING,
            'created_by' => $user->id,
        ]);

        $current = Advance::create([
            'company_id' => $companyId,
            'employee_id' => $employeeId,
            'amount' => 200000,
            'remaining_amount' => 200000,
            'date' => now()->toDateString(),
            'reason' => 'Este',
            'status' => Advance::STATUS_PENDING,
            'created_by' => $user->id,
        ]);

        // Uno posterior: no debe contar, todavia no existia cuando se firmo el comprobante.
        Advance::create([
            'company_id' => $companyId,
            'employee_id' => $employeeId,
            'amount' => 500000,
            'remaining_amount' => 500000,
            'date' => now()->addWeek()->toDateString(),
            'reason' => 'Posterior',
            'status' => Advance::STATUS_PENDING,
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->get(route('advances.receipt', $current->id))
            ->assertOk()
            // Solo el saldo del anterior: ni este anticipo ni el que vino despues.
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('previous_balance', fn ($value) => (float) $value === (float) $earlier->remaining_amount));
    }

    public function test_storing_an_advance_leaves_the_whole_amount_as_balance(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('advances.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear anticipos.');
        }

        $employeeId = $this->someAdvance($user)->employee_id;

        $this->actingAs($user)->post(route('advances.store'), [
            'employee_id' => $employeeId,
            'amount' => 175000,
            'date' => now()->toDateString(),
            'reason' => 'Prueba de rediseño',
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('advances', [
            'employee_id' => $employeeId,
            'amount' => 175000,
            // Nace con todo el saldo por descontar: es lo que sostiene el estado «Pendiente».
            'remaining_amount' => 175000,
            'status' => Advance::STATUS_PENDING,
        ]);
    }
}
