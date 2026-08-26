<?php

namespace Tests\Feature;

use App\Models\ExpenseCategory;
use App\Models\PayrollConcept;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Catalogos de categorias de gasto y conceptos de nomina tras el rediseno.
 *
 * Lo que se protege: que el estado se pueda cambiar sin salir del listado, que el orden
 * se persista de verdad, y que el conteo de uso que decide si se puede borrar llegue a la
 * pantalla en vez de descubrirse cuando el servidor rechaza el borrado.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class CatalogModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(string $permission): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can($permission));

        if ($user === null) {
            $this->markTestSkipped("No hay usuario con permiso {$permission} en esta base.");
        }

        return $user;
    }

    // ------------------------------------------------ categorias de gasto

    public function test_the_category_list_carries_the_summary_and_the_month_share(): void
    {
        $this->actingAs($this->actor('expenses.categories.view'))
            ->get(route('expense-categories.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Expenses/Categories/Index')
                ->has('categories')
                ->has('summary.total')
                ->has('summary.active')
                ->has('summary.with_movement')
                ->has('summary.month_total')
                ->where('filters.status', 'all'));
    }

    public function test_the_category_status_filter_separates_active_from_inactive(): void
    {
        $user = $this->actor('expenses.categories.view');

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $active = ExpenseCategory::query()->where('is_active', true)->count();
        $inactive = ExpenseCategory::query()->where('is_active', false)->count();

        $countFor = function (string $status) use ($user) {
            $response = $this->actingAs($user)->get(route('expense-categories.index', ['status' => $status]));
            $response->assertOk();

            return count($response->viewData('page')['props']['categories']);
        };

        $this->assertSame($active, $countFor('active'));
        $this->assertSame($inactive, $countFor('inactive'));
        $this->assertSame($active + $inactive, $countFor('all'));
    }

    public function test_a_category_is_switched_on_and_off_without_leaving_the_list(): void
    {
        $user = $this->actor('expenses.categories.edit');
        $category = ExpenseCategory::query()->first();

        if ($category === null) {
            $this->markTestSkipped('La empresa del usuario no tiene categorias.');
        }

        $before = (bool) $category->is_active;

        $this->actingAs($user)
            ->from(route('expense-categories.index'))
            ->patch(route('expense-categories.toggle', $category->id))
            ->assertSessionHas('success');

        $this->assertSame(! $before, (bool) $category->fresh()->is_active);

        // Y vuelve: el interruptor no es de un solo sentido.
        $this->actingAs($user)->patch(route('expense-categories.toggle', $category->id));
        $this->assertSame($before, (bool) $category->fresh()->is_active);
    }

    public function test_reordering_categories_persists_the_new_order(): void
    {
        $user = $this->actor('expenses.categories.edit');
        $categories = ExpenseCategory::query()->orderBy('sort_order')->get();

        if ($categories->count() < 2) {
            // Con una sola categoria no hay orden que probar; se crea una segunda.
            $categories->push(ExpenseCategory::create([
                'company_id' => $user->company_id,
                'name' => 'Categoría de prueba de orden',
                'is_active' => true,
                'sort_order' => 99,
            ]));
        }

        $reversed = $categories->reverse()->values();

        $this->actingAs($user)
            ->post(route('expense-categories.reorder'), [
                'order' => $reversed->map(fn ($category, $index) => ['id' => $category->id, 'sort_order' => $index])->all(),
            ])
            ->assertSessionHas('success');

        foreach ($reversed as $index => $category) {
            $this->assertSame($index, (int) $category->fresh()->sort_order);
        }
    }

    public function test_saving_the_form_leaves_the_record_in_the_position_it_showed(): void
    {
        $user = $this->actor('payroll_concepts.index.edit');
        $concepts = PayrollConcept::query()->orderBy('sort_order')->orderBy('name')->get();

        if ($concepts->count() < 3) {
            $this->markTestSkipped('Hacen falta al menos tres conceptos para probar el movimiento.');
        }

        $last = $concepts->last();

        // Se pide la primera posicion: el formulario mostro al registro arriba del todo.
        $this->actingAs($user)->put(route('payroll-concepts.update', $last->id), [
            'name' => $last->name,
            'code' => $last->code,
            'description' => $last->description,
            'is_active' => $last->is_active,
            'sort_order' => 0,
        ])->assertSessionHasNoErrors();

        $reordered = PayrollConcept::query()->orderBy('sort_order')->orderBy('name')->get();

        // Escribir solo esta fila dejaria dos conceptos con el mismo numero y el orden
        // final no seria el que el usuario vio.
        $this->assertSame($last->id, $reordered->first()->id);
        $this->assertSame(range(0, $reordered->count() - 1), $reordered->pluck('sort_order')->map(fn ($v) => (int) $v)->all());
    }

    public function test_the_category_form_knows_whether_it_can_be_deleted(): void
    {
        $user = $this->actor('expenses.categories.edit');
        $category = ExpenseCategory::query()->first();

        if ($category === null) {
            $this->markTestSkipped('La empresa del usuario no tiene categorias.');
        }

        $this->actingAs($user)
            ->get(route('expense-categories.edit', $category->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Expenses/Categories/Edit')
                ->has('siblings')
                // El mismo numero con el que el servidor bloquea el borrado.
                ->has('usage.count_with_trashed')
                ->has('usage.year_total')
                ->has('usage.last_used_at'));
    }

    // ------------------------------------------------ conceptos de nomina

    public function test_the_concept_list_carries_usage_and_totals(): void
    {
        $this->actingAs($this->actor('payroll_concepts.index.view'))
            ->get(route('payroll-concepts.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('PayrollConcepts/Index')
                ->has('concepts.0.adjustments_count')
                ->has('concepts.0.adjustments_total')
                ->has('concepts.0.last_used_at')
                ->has('summary.year_adjustments')
                ->has('summary.year_total'));
    }

    public function test_a_concept_is_switched_on_and_off_without_leaving_the_list(): void
    {
        $user = $this->actor('payroll_concepts.index.edit');
        $concept = PayrollConcept::query()->first();

        if ($concept === null) {
            $this->markTestSkipped('La empresa del usuario no tiene conceptos.');
        }

        $before = (bool) $concept->is_active;

        $this->actingAs($user)
            ->patch(route('payroll-concepts.toggle', $concept->id))
            ->assertSessionHas('success');

        $this->assertSame(! $before, (bool) $concept->fresh()->is_active);

        $this->actingAs($user)->patch(route('payroll-concepts.toggle', $concept->id));
        $this->assertSame($before, (bool) $concept->fresh()->is_active);
    }

    public function test_reordering_concepts_persists_the_new_order(): void
    {
        $user = $this->actor('payroll_concepts.index.edit');
        $concepts = PayrollConcept::query()->orderBy('sort_order')->orderBy('name')->get();

        if ($concepts->count() < 2) {
            $this->markTestSkipped('Hacen falta al menos dos conceptos para probar el orden.');
        }

        $reversed = $concepts->reverse()->values();

        $this->actingAs($user)
            ->post(route('payroll-concepts.reorder'), [
                'order' => $reversed->map(fn ($concept, $index) => ['id' => $concept->id, 'sort_order' => $index])->all(),
            ])
            ->assertSessionHas('success');

        foreach ($reversed as $index => $concept) {
            $this->assertSame($index, (int) $concept->fresh()->sort_order);
        }
    }

    public function test_reorder_ignores_ids_from_other_companies(): void
    {
        $user = $this->actor('payroll_concepts.index.edit');

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $foreign = PayrollConcept::query()->withoutGlobalScopes()
            ->where('company_id', '!=', $user->company_id)
            ->first();

        if ($foreign === null) {
            $this->markTestSkipped('No hay conceptos de otra empresa con los que probar el aislamiento.');
        }

        $before = (int) $foreign->sort_order;

        $this->actingAs($user)->post(route('payroll-concepts.reorder'), [
            'order' => [['id' => $foreign->id, 'sort_order' => 987]],
        ]);

        // El cliente manda ids; el servidor solo escribe sobre los suyos.
        $this->assertSame($before, (int) PayrollConcept::query()->withoutGlobalScopes()->find($foreign->id)->sort_order);
    }

    public function test_the_concept_form_carries_siblings_and_usage(): void
    {
        $user = $this->actor('payroll_concepts.index.edit');
        $concept = PayrollConcept::query()->first();

        if ($concept === null) {
            $this->markTestSkipped('La empresa del usuario no tiene conceptos.');
        }

        $this->actingAs($user)
            ->get(route('payroll-concepts.edit', $concept->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('PayrollConcepts/Edit')
                ->has('siblings')
                ->has('usage.count')
                ->has('usage.year_total')
                ->has('usage.last_used_at'));
    }
}
