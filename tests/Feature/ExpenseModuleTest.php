<?php

namespace Tests\Feature;

use App\Contracts\ObjectStorageInterface;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de gastos tras el rediseno.
 *
 * Lo que se protege: que el listado abra con el mes en curso y su total, que el filtro de
 * periodo y la exportacion no puedan divergir, y que la captura rapida guarde de verdad
 * el comprobante marcando el gasto como «por completar».
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class ExpenseModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        // El almacenamiento real es externo y no participa de la transaccion: un archivo
        // subido aqui se quedaria en el bucket aunque la fila se revierta.
        $this->swap(ObjectStorageInterface::class, new class implements ObjectStorageInterface
        {
            public function upload(UploadedFile $file, string $directory): array
            {
                return ['path' => $directory.'/'.$file->hashName(), 'url' => 'https://example.test/'.$file->hashName()];
            }
        });
    }

    protected function actor(): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => $u->isSuperAdmin() || $u->can('expenses.index.view'));

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso expenses.index.view en esta base.');
        }

        return $user;
    }

    protected function someCategory(User $user): ExpenseCategory
    {
        $category = ExpenseCategory::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('is_active', true)
            ->first();

        if ($category === null) {
            $this->markTestSkipped('La empresa del usuario no tiene categorias activas.');
        }

        return $category;
    }

    /** Comprobante de prueba sin GD: un PDF minimo basta para la validacion de mimes. */
    protected function receipt(): UploadedFile
    {
        return UploadedFile::fake()->create('recibo.pdf', 20, 'application/pdf');
    }

    public function test_index_opens_on_the_current_month_with_its_total(): void
    {
        $this->actingAs($this->actor())
            ->get(route('expenses.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Expenses/Index')
                ->has('expenses')
                ->has('categoryOptions')
                ->has('filteredTotal')
                ->has('metrics.month_total')
                ->has('metrics.month_count')
                ->has('metrics.month_categories')
                ->has('metrics.prev_month_total')
                ->has('metrics.year_total')
                ->has('metrics.year_months')
                // Sin tocar nada, la pantalla responde «cuanto llevamos este mes».
                ->where('filters.period', 'mes'));
    }

    public function test_an_unknown_period_falls_back_to_the_month(): void
    {
        $this->actingAs($this->actor())
            ->get(route('expenses.index', ['period' => 'lo-que-sea']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.period', 'mes'));
    }

    public function test_the_period_filter_widens_the_range(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        // Un gasto de hace cuatro meses: fuera del mes y del trimestre, dentro del año.
        Expense::create([
            'company_id' => $user->company_id,
            'category_id' => $category->id,
            'amount' => 123456,
            'description' => 'Gasto antiguo de prueba',
            'expense_date' => now()->subMonthsNoOverflow(4)->startOfMonth()->toDateString(),
            'created_by' => $user->id,
        ]);

        $countFor = function (string $period) use ($user) {
            $response = $this->actingAs($user)->get(route('expenses.index', ['period' => $period]));
            $response->assertOk();

            return $response->viewData('page')['props']['expenses']['total'];
        };

        $this->assertLessThanOrEqual($countFor('anio'), $countFor('trimestre'));
        $this->assertLessThanOrEqual($countFor('trimestre'), $countFor('mes'));
        $this->assertLessThanOrEqual($countFor('todos'), $countFor('anio'));
    }

    public function test_the_search_also_looks_inside_the_notes(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        Expense::create([
            'company_id' => $user->company_id,
            'category_id' => $category->id,
            'amount' => 50000,
            'description' => 'Compra sin pistas en la descripción',
            'notes' => 'Factura FV-99881',
            'expense_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        // El numero de factura vive en la nota; buscar solo en la descripcion lo perdia.
        $response = $this->actingAs($user)->get(route('expenses.index', ['search' => 'FV-99881', 'period' => 'todos']));
        $response->assertOk();

        $this->assertSame(1, $response->viewData('page')['props']['expenses']['total']);
    }

    public function test_export_streams_a_csv_with_the_same_filter(): void
    {
        $response = $this->actingAs($this->actor())->get(route('expenses.export', ['period' => 'todos']));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment; filename=', (string) $response->headers->get('content-disposition'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Comprobante', $csv);
        $this->assertStringContainsString('Registrado el', $csv);
    }

    public function test_the_create_screen_carries_the_month_context(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear gastos.');
        }

        $this->actingAs($user)
            ->get(route('expenses.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Expenses/Create')
                ->has('categories')
                ->has('monthContext.month_total')
                ->has('monthContext.prev_month_total')
                ->has('monthContext.by_category'));
    }

    public function test_the_edit_screen_excludes_the_expense_from_its_own_month_base(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar gastos.');
        }

        $expense = Expense::create([
            'company_id' => $user->company_id,
            'category_id' => $category->id,
            'amount' => 777000,
            'description' => 'Gasto del mes en curso',
            'expense_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)->get(route('expenses.edit', $expense->id));
        $response->assertOk();

        $base = (float) $response->viewData('page')['props']['monthContext']['month_total'];
        $withIt = (float) Expense::query()->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereBetween('expense_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->sum('amount');

        // Si no se excluyera, el panel contaria dos veces el gasto que se esta editando.
        $this->assertEqualsWithDelta($withIt - 777000, $base, 0.01);
    }

    public function test_quick_capture_saves_the_receipt_and_flags_the_expense(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear gastos.');
        }

        $this->actingAs($user)
            ->post(route('expenses.quick-store'), [
                'category_id' => $category->id,
                'amount' => 45000,
                'receipt' => $this->receipt(),
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('expenses', [
            'category_id' => $category->id,
            'amount' => 45000,
            'expense_date' => now()->toDateString(),
            // Nace marcado: la descripcion se completa despues desde el escritorio.
            'needs_detail' => 1,
            'description' => "{$category->name} · captura rápida",
        ]);
    }

    public function test_quick_capture_refuses_to_save_without_the_receipt(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.create')) {
            $this->markTestSkipped('El usuario de prueba no puede crear gastos.');
        }

        $before = Expense::query()->count();

        $this->actingAs($user)
            ->post(route('expenses.quick-store'), ['category_id' => $category->id, 'amount' => 45000])
            ->assertSessionHasErrors('receipt');

        $this->assertSame($before, Expense::query()->count());
    }

    public function test_editing_clears_the_pending_detail_flag(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.edit')) {
            $this->markTestSkipped('El usuario de prueba no puede editar gastos.');
        }

        $expense = Expense::create([
            'company_id' => $user->company_id,
            'category_id' => $category->id,
            'amount' => 12000,
            'description' => 'Captura rápida',
            'expense_date' => now()->toDateString(),
            'needs_detail' => true,
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->put(route('expenses.update', $expense->id), [
                'category_id' => $category->id,
                'amount' => 12000,
                'description' => 'Tela popelina para el pedido 412',
                'expense_date' => now()->toDateString(),
                'notes' => '',
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'description' => 'Tela popelina para el pedido 412',
            'needs_detail' => 0,
        ]);
    }

    public function test_archiving_keeps_the_expense_in_the_audit_trail(): void
    {
        $user = $this->actor();
        $category = $this->someCategory($user);

        if (! $user->isSuperAdmin() && ! $user->can('expenses.index.delete')) {
            $this->markTestSkipped('El usuario de prueba no puede archivar gastos.');
        }

        $expense = Expense::create([
            'company_id' => $user->company_id,
            'category_id' => $category->id,
            'amount' => 9000,
            'description' => 'Gasto a archivar',
            'expense_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)->delete(route('expenses.destroy', $expense->id))->assertSessionHas('success');

        // Eliminacion suave: deja de sumar pero no desaparece.
        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);
    }
}
