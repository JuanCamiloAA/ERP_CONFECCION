<?php

namespace Tests\Feature;

use App\Models\Holiday;
use App\Models\PayrollLegalParameter;
use App\Models\User;
use App\Services\HolidayService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Festivos y parametros legales tras el rediseno.
 *
 * Lo que se protege: que un festivo trasladado diga de que fecha viene, que la pantalla
 * de parametros diga cual es el tramo que rige hoy, y que dos tramos del mismo alcance no
 * se puedan solapar sin que el mensaje nombre al culpable.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class HolidayLegalParameterTest extends TestCase
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

    // ------------------------------------------------------------ festivos

    public function test_the_holiday_service_knows_where_each_shifted_day_came_from(): void
    {
        $map = app(HolidayService::class)->originalDatesFor(2026);

        // Reyes Magos cae el 6 de enero de 2026 (martes) y se traslada al lunes 12.
        $this->assertArrayHasKey('2026-01-12', $map);
        $this->assertSame('2026-01-06', $map['2026-01-12']);

        // Los de fecha fija no aparecen: no se trasladan.
        $this->assertArrayNotHasKey('2026-01-01', $map);
    }

    public function test_the_holiday_screen_reports_the_original_date_and_the_last_sync(): void
    {
        $this->actingAs($this->actor('holidays.index.view'))
            ->get(route('holidays.index', ['year' => 2026]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Holidays/Index')
                ->has('holidays')
                ->has('lastSyncedAt')
                ->where('filters.year', 2026)
                // Todo festivo trasladado dice de que fecha viene.
                ->where('holidays', fn ($holidays) => collect($holidays)
                    ->every(fn ($holiday) => ! $holiday['is_emiliani_shifted'] || $holiday['original_date'] !== null)));
    }

    public function test_an_absurd_year_is_clamped_instead_of_showing_an_empty_screen(): void
    {
        $this->actingAs($this->actor('holidays.index.view'))
            ->get(route('holidays.index', ['year' => 99999]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('filters.year', 2100));
    }

    public function test_only_manual_holidays_can_be_deleted(): void
    {
        $user = $this->actor('holidays.index.delete');

        $calculated = Holiday::query()->where('source', Holiday::SOURCE_CALCULATED)->first();

        if ($calculated === null) {
            $this->markTestSkipped('No hay festivos calculados en esta base.');
        }

        // La politica lo corta antes del controlador: los calculados se regeneran con
        // «Sincronizar», no se borran a mano. Por eso la lista solo pinta la papelera en
        // los manuales.
        $this->actingAs($user)
            ->from(route('holidays.index'))
            ->delete(route('holidays.destroy', $calculated->id))
            ->assertForbidden();

        $this->assertDatabaseHas('holidays', ['id' => $calculated->id]);

        $manual = Holiday::create([
            'country_code' => 'CO',
            'date' => '2026-02-17',
            'name' => 'Festivo manual de prueba',
            'source' => Holiday::SOURCE_MANUAL,
            'is_emiliani_shifted' => false,
        ]);

        $this->actingAs($user)
            ->delete(route('holidays.destroy', $manual->id))
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('holidays', ['id' => $manual->id]);
    }

    // -------------------------------------------------- parametros legales

    public function test_the_parameters_screen_says_which_tramo_rules_today(): void
    {
        $this->actingAs($this->actor('payroll_legal_parameters.index.view'))
            ->get(route('payroll-legal-parameters.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('PayrollLegalParameters/Index')
                ->has('parameters')
                ->has('salaryExample')
                ->has('active')
                // Cada fila dice su alcance y si es la vigente.
                ->where('parameters', fn ($rows) => collect($rows)
                    ->every(fn ($row) => in_array($row['scope'], ['global', 'company'], true)
                        && array_key_exists('is_active', $row))));
    }

    public function test_the_active_tramo_is_the_company_one_when_both_cover_today(): void
    {
        $user = $this->actor('payroll_legal_parameters.index.view');

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $response = $this->actingAs($user)->get(route('payroll-legal-parameters.index'));
        $response->assertOk();

        $props = $response->viewData('page')['props'];
        $active = $props['active'];

        if ($active === null) {
            $this->markTestSkipped('Ningún tramo cubre la fecha de hoy en esta base.');
        }

        $today = now()->toDateString();
        $covering = collect($props['parameters'])->filter(
            fn ($row) => $row['effective_from'] <= $today && ($row['effective_to'] === null || $row['effective_to'] >= $today),
        );

        // Si hay uno de la empresa cubriendo hoy, ese es el que manda.
        if ($covering->contains(fn ($row) => $row['scope'] === 'company')) {
            $this->assertSame('company', $active['scope']);
        }

        $this->assertTrue($active['is_active']);
    }

    public function test_two_tramos_of_the_same_scope_cannot_overlap(): void
    {
        $user = $this->actor('payroll_legal_parameters.index.create');

        if ($user->isSuperAdmin()) {
            $this->markTestSkipped('Con super admin el alcance depende de la empresa activa.');
        }

        $existing = PayrollLegalParameter::query()->where('company_id', $user->company_id)->first();

        if ($existing === null) {
            // Sin tramo propio no hay solape que probar: se crea uno y se intenta repetir.
            $existing = PayrollLegalParameter::create($this->tramoPayload($user->company_id, '2030-01-01', '2030-12-31'));
        }

        $response = $this->actingAs($user)->post(route('payroll-legal-parameters.store'), array_merge(
            $this->tramoPayload(null, $existing->effective_from->toDateString(), $existing->effective_to?->toDateString() ?? ''),
            ['is_global' => false],
        ));

        $response->assertSessionHasErrors('effective_from');

        $message = session('errors')->first('effective_from');

        // El mensaje nombra el tramo en conflicto, no dice solo «se solapa».
        $this->assertStringContainsString($existing->effective_from->format('d/m/Y'), $message);
        $this->assertStringContainsString('esta empresa', $message);
    }

    /**
     * @return array<string, mixed>
     */
    protected function tramoPayload(?int $companyId, string $from, string $to): array
    {
        return [
            'company_id' => $companyId,
            'effective_from' => $from,
            'effective_to' => $to === '' ? null : $to,
            'weekly_legal_hours' => '42',
            'monthly_hours_divisor' => '210',
            'night_start_time' => '19:00',
            'night_end_time' => '06:00',
            'night_surcharge_percent' => '35',
            'overtime_day_percent' => '25',
            'overtime_night_percent' => '75',
            'sunday_holiday_surcharge_percent' => '75',
            'max_overtime_hours_per_day' => '2',
            'max_overtime_hours_per_week' => '12',
            'discount_unexcused_absences' => false,
            'absence_discount_percent' => '100',
            'legal_reference' => 'Prueba de solape',
        ];
    }

    public function test_the_tramo_form_carries_the_active_tramo_to_compare_against(): void
    {
        $user = $this->actor('payroll_legal_parameters.index.create');

        $this->actingAs($user)
            ->get(route('payroll-legal-parameters.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('PayrollLegalParameters/Create')
                ->has('salaryExample')
                ->has('active')
                ->has('isSuperAdmin'));
    }
}
