<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\PayrollPeriodicity;
use App\Models\Scopes\CompanyScope;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Modulo de nomina tras el rediseno.
 *
 * Lo que se protege: que el flujo borrador -> calculado -> aprobado -> pagado llegue al
 * front con sus cifras, que el filtro abiertas/cerradas separe de verdad, y que las dos
 * pantallas nuevas (ficha del empleado y comprobante individual) respondan y no dejen ver
 * una nomina de otro periodo.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class PayrollModuleTest extends TestCase
{
    use DatabaseTransactions;

    protected function actor(): User
    {
        $candidates = User::query()->whereNotNull('company_id')->get();

        // Se prefiere un usuario de empresa: para el super admin el detalle exige que la
        // empresa activa del selector coincida, y eso no se puede fijar desde aqui.
        $user = $candidates->first(fn (User $u) => ! $u->isSuperAdmin() && $u->can('payrolls.index.view'))
            ?? $candidates->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuario con permiso payrolls.index.view en esta base.');
        }

        return $user;
    }

    protected function somePayroll(User $user): Payroll
    {
        $payroll = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->orderByDesc('period_start')
            ->first();

        if ($payroll === null) {
            $this->markTestSkipped('La empresa del usuario no tiene nominas.');
        }

        return $payroll;
    }

    protected function someCalculatedRow(User $user): PayrollEmployee
    {
        $row = PayrollEmployee::query()
            ->whereHas('payroll', fn ($q) => $q->withoutGlobalScope(CompanyScope::class)->where('company_id', $user->company_id))
            ->first();

        if ($row === null) {
            $this->markTestSkipped('La empresa del usuario no tiene nominas con empleados liquidados.');
        }

        return $row;
    }

    public function test_index_exposes_the_flow_metrics_and_filters(): void
    {
        $this->actingAs($this->actor())
            ->get(route('payrolls.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Payrolls/Index')
                ->has('payrolls')
                ->has('periodicities')
                ->has('years')
                ->has('metrics.open_net')
                ->has('metrics.open_employees')
                ->has('metrics.year_paid')
                ->has('metrics.year_closed_count')
                ->has('metrics.year_approved_unpaid')
                ->has('metrics.average_per_employee')
                ->has('metrics.filtered_open_count')
                // Por defecto se ven las abiertas: lo que todavia pide una accion.
                ->where('filters.state', 'open'));
    }

    public function test_the_state_filter_separates_open_from_closed(): void
    {
        $user = $this->actor();
        $year = (int) now()->year;

        $open = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->whereYear('period_start', $year)
            ->whereIn('status', [Payroll::STATUS_DRAFT, Payroll::STATUS_CALCULATED])
            ->count();

        $closed = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->whereYear('period_start', $year)
            ->whereIn('status', [Payroll::STATUS_APPROVED, Payroll::STATUS_PAID])
            ->count();

        $this->actingAs($user)
            ->get(route('payrolls.index', ['state' => 'open', 'year' => $year]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('payrolls.total', $open));

        $this->actingAs($user)
            ->get(route('payrolls.index', ['state' => 'closed', 'year' => $year]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('payrolls.total', $closed));
    }

    public function test_create_suggests_a_period_for_every_active_periodicity(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('payrolls.index.create')) {
            $this->markTestSkipped('El usuario no puede crear nominas.');
        }

        $codes = PayrollPeriodicity::query()->active()->ordered()->pluck('code')->all();

        $this->actingAs($user)
            ->get(route('payrolls.create'))
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) use ($codes) {
                $page->component('Payrolls/Create')->has('suggestions')->has('existingPeriods');

                foreach ($codes as $code) {
                    $page->has("suggestions.{$code}.period_start")
                        ->has("suggestions.{$code}.period_end")
                        ->has("suggestions.{$code}.name");
                }
            });
    }

    public function test_the_suggested_period_starts_the_day_after_the_last_close(): void
    {
        $user = $this->actor();

        if (! $user->isSuperAdmin() && ! $user->can('payrolls.index.create')) {
            $this->markTestSkipped('El usuario no puede crear nominas.');
        }

        $last = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->orderByDesc('period_end')
            ->orderByDesc('id')
            ->first();

        if ($last === null) {
            $this->markTestSkipped('La empresa del usuario no tiene nominas previas.');
        }

        $expected = $last->period_end->copy()->addDay()->toDateString();

        $this->actingAs($user)
            ->get(route('payrolls.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('suggestions.quincenal.period_start', $expected));
    }

    public function test_show_exposes_the_totals_strip_and_the_period_labels(): void
    {
        $user = $this->actor();
        $payroll = $this->somePayroll($user);

        $this->actingAs($user)
            ->get(route('payrolls.show', $payroll->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Payrolls/Show')
                ->has('payrollEmployees')
                ->has('payrollEmployeeTotals.total_gross')
                ->has('payrollEmployeeTotals.total_deductions')
                ->has('payrollEmployeeTotals.show_daily_column')
                ->has('payrollEmployeeTotals.show_legal_column')
                ->has('workSessionsByEmployee')
                ->has('productionsByEmployee')
                ->has('periodicityName'));
    }

    public function test_the_employee_sheet_carries_the_absence_baseline_of_the_whole_payroll(): void
    {
        $user = $this->actor();
        $row = $this->someCalculatedRow($user);

        $this->actingAs($user)
            ->get(route('payrolls.payroll-employees.show', [$row->payroll_id, $row->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Payrolls/Employee')
                ->has('payrollEmployee')
                ->has('workSessions')
                ->has('productions')
                // Sin el retrato de toda la nomina, guardar desde la ficha revertiria las
                // exclusiones de inasistencia de los demas empleados.
                ->has('absenceBaseline')
                ->has('siblings.total')
                ->has('siblings.position'));
    }

    public function test_the_employee_sheet_rejects_a_row_from_another_payroll(): void
    {
        $user = $this->actor();
        $row = $this->someCalculatedRow($user);

        $otherPayroll = Payroll::query()->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $user->company_id)
            ->where('id', '!=', $row->payroll_id)
            ->first();

        if ($otherPayroll === null) {
            $this->markTestSkipped('La empresa del usuario solo tiene una nomina.');
        }

        $this->actingAs($user)
            ->get(route('payrolls.payroll-employees.show', [$otherPayroll->id, $row->id]))
            ->assertNotFound();
    }

    public function test_the_individual_receipt_renders(): void
    {
        $user = $this->actor();
        $row = $this->someCalculatedRow($user);

        $this->actingAs($user)
            ->get(route('payrolls.payroll-employees.receipt', [$row->payroll_id, $row->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Payrolls/Receipt')
                ->has('payroll.company')
                ->has('payrollEmployee')
                ->has('workSessions')
                ->has('productions'));
    }

    public function test_the_listing_export_streams_a_csv_with_the_applied_filter(): void
    {
        $response = $this->actingAs($this->actor())
            ->get(route('payrolls.export-list', ['state' => 'all', 'year' => now()->year]));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Nomina', $csv);
        $this->assertStringContainsString('Periodicidad', $csv);
        $this->assertStringContainsString('Neto', $csv);
    }
}
