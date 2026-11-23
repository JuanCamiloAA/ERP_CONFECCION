<?php

namespace Tests\Feature;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Operation;
use App\Models\Production;
use App\Models\Reference;
use App\Models\ReferenceLot;
use App\Models\User;
use App\Services\CompanyDefaultRolesService;
use App\Services\UserPermissionService;
use App\Support\ReferenceLotCapacity;
use App\Support\ReferenceLotTotals;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Validator;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Reprogramar una referencia: un lote nuevo de la misma prenda, con su cantidad, su valor
 * por unidad y sus precios de operacion, sin crear otra referencia.
 *
 * Lo que se protege: que el conteo del lote vuelva a cero sin tocar lo ya producido, que
 * la programacion cerrada quede guardada tal como estaba y que la produccion (registrar,
 * corregir, eliminar) mida contra la programacion correcta.
 *
 * Siembra su propia empresa y lo revierte todo al terminar.
 */
class ReferenceReprogramTest extends TestCase
{
    use DatabaseTransactions;

    protected Company $company;

    protected User $admin;

    protected Employee $employee;

    protected Operation $cut;

    protected Operation $sew;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        app(CompanyDefaultRolesService::class)->ensureDefaultRolesForCompany($this->company);

        $this->admin = User::factory()->create(['company_id' => $this->company->id]);
        app(UserPermissionService::class)->sync($this->admin, PermissionHelper::presetPermissions('admin'), $this->admin);
        $this->admin->refresh();

        $this->employee = Employee::factory()->create(['company_id' => $this->company->id]);
        $this->cut = Operation::factory()->create(['company_id' => $this->company->id, 'name' => 'Corte']);
        $this->sew = Operation::factory()->create(['company_id' => $this->company->id, 'name' => 'Costura']);
    }

    /** Referencia con lote de 10 y dos operaciones (corte 1.000, costura 2.000). */
    protected function reference(): Reference
    {
        $reference = Reference::factory()->create([
            'company_id' => $this->company->id,
            'lot_total_quantity' => 10,
            'payment_per_unit' => 5000,
        ]);

        $reference->operations()->sync([
            $this->cut->id => ['price' => 1000, 'is_active' => true],
            $this->sew->id => ['price' => 2000, 'is_active' => true],
        ]);
        $reference->refreshOperationalCost();

        return $reference->refresh();
    }

    protected function produce(Reference $reference, Operation $operation, int $quantity, float $price): Production
    {
        return Production::create([
            'company_id' => $this->company->id,
            'employee_id' => $this->employee->id,
            'reference_id' => $reference->id,
            'operation_id' => $operation->id,
            'quantity' => $quantity,
            'unit_price' => $price,
            'date' => now()->toDateString(),
            'status' => Production::STATUS_CONFIRMED,
            'shift' => 'manana',
            'created_by' => $this->admin->id,
        ]);
    }

    /** Errores que daria el tope del lote para esa cantidad. */
    protected function lotErrors(Reference $reference, Operation $operation, int $quantity, ?int $exclude = null, ?int $lot = null): array
    {
        $validator = Validator::make([], []);
        ReferenceLotCapacity::assertWithinLot($validator, $reference->id, $operation->id, $quantity, $exclude, $lot);

        return $validator->errors()->get('quantity');
    }

    /** Lote 1 completo: la referencia se cierra sola, como hasta hoy. */
    protected function completedReference(): Reference
    {
        $reference = $this->reference();
        $this->produce($reference, $this->cut, 10, 1000);
        $this->produce($reference, $this->sew, 10, 2000);

        $reference->refresh();
        $this->assertFalse($reference->is_active, 'Con el lote completo la referencia debe cerrarse.');

        return $reference;
    }

    public function test_reprogramming_opens_a_new_lot_with_new_quantity_and_values(): void
    {
        $reference = $this->completedReference();

        $this->actingAs($this->admin)
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 25,
                'payment_per_unit' => 6500,
                'operations' => [
                    ['operation_id' => $this->cut->id, 'price' => 1200],
                    ['operation_id' => $this->sew->id, 'price' => 2300],
                ],
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('references.show', $reference));

        $reference->refresh();

        // La misma referencia, en la programacion 2, abierta y con los valores nuevos.
        $this->assertSame(2, $reference->lot_number);
        $this->assertSame(25, $reference->lot_total_quantity);
        $this->assertEquals(6500, (float) $reference->payment_per_unit);
        $this->assertEquals(3500, (float) $reference->operational_cost_per_unit_fixed);
        $this->assertTrue($reference->is_active);
        $this->assertSame(0, $reference->referenceOperations()->where('is_active', false)->count());
        $this->assertEquals(1200, (float) $reference->referenceOperations()->where('operation_id', $this->cut->id)->value('price'));

        // La programacion 1 queda guardada con lo que valia entonces.
        $closed = ReferenceLot::query()->where('reference_id', $reference->id)->sole();
        $this->assertSame(1, $closed->lot_number);
        $this->assertSame(10, $closed->lot_total_quantity);
        $this->assertEquals(5000, (float) $closed->payment_per_unit);
        $this->assertEquals(3000, (float) $closed->operational_cost_per_unit);
        $this->assertEqualsCanonicalizing([1000.0, 2000.0], array_column($closed->operations, 'price'));
        $this->assertSame($this->admin->id, $closed->closed_by);

        // Lo producido no se toca: sigue en la programacion 1 y con su precio.
        $this->assertSame(2, Production::query()->where('reference_id', $reference->id)->where('lot_number', 1)->count());
        $this->assertEquals(1000, (float) Production::query()->where('reference_id', $reference->id)->where('operation_id', $this->cut->id)->value('unit_price'));
    }

    public function test_the_lot_counts_from_zero_after_reprogramming(): void
    {
        $reference = $this->completedReference();
        $this->assertNotEmpty($this->lotErrors($reference, $this->cut, 1), 'El lote 1 ya estaba lleno.');

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 25,
            'payment_per_unit' => 6500,
        ])->assertSessionHasNoErrors();

        $reference->refresh();

        $this->assertSame([], $this->lotErrors($reference, $this->cut, 25));
        $this->assertNotEmpty($this->lotErrors($reference, $this->cut, 26));

        // Lo nuevo entra solo en la programacion vigente.
        $new = $this->produce($reference, $this->cut, 5, 1000);
        $this->assertSame(2, $new->lot_number);
        $this->assertSame([$this->cut->id => 5], ReferenceLotTotals::byOperation($reference->id, 2));
        $this->assertSame([], $this->lotErrors($reference, $this->cut, 20));
        $this->assertNotEmpty($this->lotErrors($reference, $this->cut, 21));
    }

    public function test_reprogramming_without_production_in_the_current_lot_is_refused(): void
    {
        $reference = $this->reference();

        $this->actingAs($this->admin)
            ->from(route('references.reprogram', $reference))
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 25,
                'payment_per_unit' => 6500,
            ])
            ->assertSessionHasErrors('reprogram');

        $this->assertSame(1, $reference->refresh()->lot_number);
        $this->assertSame(0, ReferenceLot::query()->where('reference_id', $reference->id)->count());
    }

    public function test_operations_of_another_company_are_refused(): void
    {
        $reference = $this->completedReference();
        $foreign = Operation::factory()->create(['company_id' => Company::factory()->create()->id]);

        $this->actingAs($this->admin)
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 25,
                'payment_per_unit' => 6500,
                'operations' => [
                    ['operation_id' => $this->cut->id, 'price' => 1000],
                    ['operation_id' => $foreign->id, 'price' => 999],
                ],
            ])
            ->assertSessionHasErrors('operations.1.operation_id');

        $this->assertSame(1, $reference->refresh()->lot_number);
    }

    public function test_the_new_lot_needs_at_least_one_operation(): void
    {
        $reference = $this->completedReference();

        $this->actingAs($this->admin)
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 25,
                'payment_per_unit' => 6500,
                'operations' => [],
            ])
            ->assertSessionHasErrors('operations');

        $this->assertSame(1, $reference->refresh()->lot_number);
        $this->assertSame(2, $reference->referenceOperations()->count());
    }

    public function test_reprogramming_adds_and_removes_operations(): void
    {
        $reference = $this->completedReference();
        $embroidery = Operation::factory()->create(['company_id' => $this->company->id, 'name' => 'Bordado']);

        // El pedido nuevo lleva bordado y no lleva costura.
        $this->actingAs($this->admin)
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 40,
                'payment_per_unit' => 7000,
                'operations' => [
                    ['operation_id' => $this->cut->id, 'price' => 1100, 'estimated_minutes' => 2],
                    ['operation_id' => $embroidery->id, 'price' => 2500, 'estimated_minutes' => 6],
                ],
            ])
            ->assertSessionHasNoErrors();

        $reference->refresh();

        $this->assertEqualsCanonicalizing(
            [$this->cut->id, $embroidery->id],
            $reference->referenceOperations()->pluck('operation_id')->map(fn ($id) => (int) $id)->all(),
        );
        $this->assertEquals(2500, (float) $reference->referenceOperations()->where('operation_id', $embroidery->id)->value('price'));
        $this->assertNotNull($reference->referenceOperations()->where('operation_id', $embroidery->id)->value('difficulty_level'));
        $this->assertSame(0, $reference->referenceOperations()->where('is_active', false)->count());
        $this->assertEquals(3600, (float) $reference->operational_cost_per_unit_fixed);

        // La foto de la programacion 1 conserva la costura quitada.
        $closed = ReferenceLot::query()->where('reference_id', $reference->id)->sole();
        $this->assertEqualsCanonicalizing(['Corte', 'Costura'], array_column($closed->operations, 'name'));

        // Y lo producido con ella sigue ahi, con su precio.
        $this->assertEquals(2000, (float) Production::query()
            ->where('reference_id', $reference->id)
            ->where('operation_id', $this->sew->id)
            ->value('unit_price'));

        // El lote nuevo se cierra con las operaciones que SI lleva: la costura ya no cuenta.
        $this->produce($reference, $this->cut, 40, 1100);
        $this->assertTrue($reference->refresh()->is_active);
        $this->produce($reference, $embroidery, 40, 2500);
        $this->assertFalse($reference->refresh()->is_active);
    }

    public function test_a_record_of_a_removed_operation_can_still_be_corrected(): void
    {
        $reference = $this->reference();
        $old = $this->produce($reference, $this->sew, 4, 2000);
        $this->produce($reference, $this->cut, 1, 1000);

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 30,
            'payment_per_unit' => 6500,
            'operations' => [['operation_id' => $this->cut->id, 'price' => 1300]],
        ])->assertSessionHasNoErrors();

        // El formulario de edicion sigue ofreciendo la operacion del registro, con su precio.
        $this->actingAs($this->admin)
            ->get(route('productions.edit', $old))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Edit')
                ->where('references', fn ($refs) => collect($refs)->contains(fn ($r) => $r['id'] === $reference->id
                    && collect($r['operations'])->contains(fn ($op) => $op['id'] === $this->sew->id
                        && (float) $op['pivot']['price'] === 2000.0))));

        // Corregir la cantidad dentro de su lote (10) se acepta y no cambia su precio.
        $this->actingAs($this->admin)
            ->put(route('productions.update', $old), [
                'employee_id' => $this->employee->id,
                'reference_id' => $reference->id,
                'operation_id' => $this->sew->id,
                'quantity' => 9,
                'date' => now()->toDateString(),
                'shift' => 'manana',
            ])
            ->assertSessionHasNoErrors();

        $old->refresh();
        $this->assertSame(9, $old->quantity);
        $this->assertSame(1, $old->lot_number);
        $this->assertEquals(2000, (float) $old->unit_price);

        // Y no se le permite pasar del lote de su programacion.
        $this->actingAs($this->admin)
            ->put(route('productions.update', $old), [
                'employee_id' => $this->employee->id,
                'reference_id' => $reference->id,
                'operation_id' => $this->sew->id,
                'quantity' => 11,
                'date' => now()->toDateString(),
                'shift' => 'manana',
            ])
            ->assertSessionHasErrors('quantity');
    }

    public function test_edit_can_remove_an_operation_produced_only_in_a_closed_lot(): void
    {
        $reference = $this->completedReference();

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 25,
            'payment_per_unit' => 6500,
        ])->assertSessionHasNoErrors();

        $payload = fn (array $operations) => [
            '_method' => 'put',
            'code' => $reference->code,
            'name' => $reference->name,
            'payment_per_unit' => 6500,
            'lot_total_quantity' => 25,
            'operations' => $operations,
        ];

        // La costura solo se produjo en la programacion 1: quitarla de la 2 es valido.
        $this->actingAs($this->admin)
            ->post(route('references.update', $reference), $payload([['operation_id' => $this->cut->id, 'price' => 1000]]))
            ->assertSessionHasNoErrors();

        $this->assertSame([$this->cut->id], $reference->referenceOperations()->pluck('operation_id')->map(fn ($id) => (int) $id)->all());

        // Con produccion en la programacion vigente, quitarla sigue bloqueado.
        $this->produce($reference->refresh(), $this->cut, 3, 1000);

        $this->actingAs($this->admin)
            ->post(route('references.update', $reference), $payload([['operation_id' => $this->sew->id, 'price' => 2000]]))
            ->assertSessionHasErrors('operations');
    }

    public function test_a_record_of_a_closed_lot_is_measured_against_its_own_lot(): void
    {
        $reference = $this->reference();
        $old = $this->produce($reference, $this->cut, 4, 1000);

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 50,
            'payment_per_unit' => 6500,
        ])->assertSessionHasNoErrors();

        $reference->refresh();

        // En su programacion (lote 10) puede llegar a 10, no a 50.
        $this->assertSame([], $this->lotErrors($reference, $this->cut, 10, $old->id, 1));
        $this->assertNotEmpty($this->lotErrors($reference, $this->cut, 11, $old->id, 1));

        // Corregirlo sin cambiar de referencia lo deja en su programacion.
        $old->update(['quantity' => 6]);
        $this->assertSame(1, $old->refresh()->lot_number);
    }

    public function test_a_deleted_record_frees_its_units_in_the_lot(): void
    {
        $reference = $this->reference();
        $record = $this->produce($reference, $this->cut, 10, 1000);
        $this->assertNotEmpty($this->lotErrors($reference, $this->cut, 1));

        $record->delete();

        $this->assertSame([], $this->lotErrors($reference->refresh(), $this->cut, 10));
    }

    public function test_show_lists_the_lot_history_and_index_measures_the_current_lot(): void
    {
        $reference = $this->completedReference();

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 25,
            'payment_per_unit' => 6500,
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->admin)
            ->get(route('references.show', $reference))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('References/Show')
                ->has('lots', 2)
                ->where('lots.0.lot_number', 2)
                ->where('lots.0.is_current', true)
                ->where('lots.0.produced_max', 0)
                ->where('lots.1.lot_number', 1)
                ->where('lots.1.lot_total_quantity', 10)
                ->where('lots.1.produced_max', 10)
                ->where('lots.1.operations_completed', 2)
                ->where('reference.productions_max_per_operation', 0));

        $this->actingAs($this->admin)
            ->get(route('references.reprogram', $reference))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('References/Reprogram')
                ->where('currentLot.lot_number', 2));
    }

    public function test_production_screens_work_with_the_current_and_the_closed_lot(): void
    {
        $reference = $this->reference();
        $old = $this->produce($reference, $this->cut, 4, 1000);

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 30,
            'payment_per_unit' => 6500,
            'operations' => [
                ['operation_id' => $this->cut->id, 'price' => 1500],
                ['operation_id' => $this->sew->id, 'price' => 2000],
            ],
        ])->assertSessionHasNoErrors();

        // Registrar por el formulario real: entra en la programacion 2 y el saldo es el nuevo.
        $this->actingAs($this->admin)->post(route('productions.store'), [
            'employee_id' => $this->employee->id,
            'reference_id' => $reference->id,
            'operation_id' => $this->cut->id,
            'quantity' => 30,
            'date' => now()->toDateString(),
            'shift' => 'tarde',
        ])->assertSessionHasNoErrors();

        $new = Production::query()->where('reference_id', $reference->id)->latest('id')->firstOrFail();
        $this->assertSame(2, $new->lot_number);
        // Sin precio en el formulario, toma el de la programacion nueva.
        $this->assertEquals(1500, (float) $new->unit_price);

        $this->actingAs($this->admin)
            ->get(route('productions.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Create')
                ->where('references', fn ($refs) => collect($refs)->contains(fn ($r) => $r['id'] === $reference->id
                    && $r['lot_number'] === 2
                    && (int) ($r['productions_quantity_by_operation'][$this->cut->id] ?? 0) === 30)));

        // El registro viejo se edita contra el lote de su programacion (10), no el de hoy.
        $this->actingAs($this->admin)
            ->get(route('productions.edit', $old))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Productions/Edit')
                ->where('productionLot.lot_number', 1)
                ->where('productionLot.is_current', false)
                ->where('productionLot.lot_total_quantity', 10));

        $this->actingAs($this->admin)
            ->get(route('productions.export'))
            ->assertOk();
    }

    public function test_reference_export_reports_the_current_lot(): void
    {
        $reference = $this->completedReference();

        $this->actingAs($this->admin)->post(route('references.reprogram.store', $reference), [
            'lot_total_quantity' => 25,
            'payment_per_unit' => 6500,
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->admin)
            ->get(route('references.export.pdf', ['ids' => $reference->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('References/Print')
                ->where('references.0.lot_number', 2)
                ->where('references.0.lot_total_quantity', 25)
                ->where('references.0.produced_max_per_operation', 0));

        $excel = $this->actingAs($this->admin)->get(route('references.export.excel', ['ids' => $reference->id]));
        $excel->assertOk();
        $this->assertSame('PK', substr((string) $excel->getContent(), 0, 2));
    }

    public function test_reprogramming_requires_its_permission(): void
    {
        $reference = $this->completedReference();

        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        app(UserPermissionService::class)->sync($viewer, ['references.index.view', 'references.show.view'], $this->admin);

        $this->actingAs($viewer->refresh())
            ->post(route('references.reprogram.store', $reference), [
                'lot_total_quantity' => 25,
                'payment_per_unit' => 6500,
            ])
            ->assertForbidden();

        $this->assertSame(1, $reference->refresh()->lot_number);
    }
}
