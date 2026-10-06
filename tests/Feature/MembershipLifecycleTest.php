<?php

namespace Tests\Feature;

use App\Models\BillingCycle;
use App\Models\Company;
use App\Models\CompanyBillingCharge;
use App\Models\CompanyMembershipEvent;
use App\Models\MembershipPlan;
use App\Models\User;
use App\Services\Membership\MembershipPricing;
use App\Services\Membership\MembershipService;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Ciclo de vida de la membresia: periodos de cobro, precios, gracia, suspension, pago
 * manual y bitacora.
 *
 * Lo que se protege, en orden de gravedad: que una empresa suspendida no use el sistema
 * pero si pueda llegar a pagar; que un pago no renueve dos veces; que el vencimiento siga
 * valiendo todo el dia, como antes; y que el precio mensual no cambie por el redondeo.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class MembershipLifecycleTest extends TestCase
{
    use DatabaseTransactions;

    protected function plan(array $overrides = []): MembershipPlan
    {
        return MembershipPlan::query()->create(array_merge([
            'name' => 'Plan prueba',
            'slug' => 'plan-prueba-'.Str::lower(Str::random(6)),
            'price_monthly' => 150000,
            'trial_days' => 0,
            'is_active' => true,
        ], $overrides));
    }

    protected function monthly(): BillingCycle
    {
        return BillingCycle::query()->where('code', 'mensual')->firstOrFail();
    }

    protected function company(string $status, ?Carbon $endsAt, ?Carbon $graceEndsAt = null, ?MembershipPlan $plan = null): Company
    {
        $company = Company::factory()->create([
            'membership_plan_id' => ($plan ?? $this->plan())->id,
            'billing_cycle_id' => $this->monthly()->id,
            'membership_started_at' => Carbon::today()->subMonths(2),
            'membership_ends_at' => $endsAt,
        ]);

        $company->forceFill(['membership_status' => $status, 'grace_ends_at' => $graceEndsAt])->save();

        return $company->refresh();
    }

    /**
     * @param  list<string>  $permissions
     */
    protected function userOf(Company $company, array $permissions): User
    {
        $user = User::factory()->create(['company_id' => $company->id]);

        app(UserPermissionService::class)->sync($user, $permissions, $user);

        return $user->refresh();
    }

    protected function superAdmin(): User
    {
        $user = User::query()->get()->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay super admin en esta base.');
        }

        return $user;
    }

    /* ------------------------------------------------------------------ precios */

    public function test_el_mensual_no_se_redondea_y_con_descuento_sube_al_siguiente_mil(): void
    {
        $plan = $this->plan(['price_monthly' => 149990]);

        $monthly = new BillingCycle(['months' => 1, 'discount_percent' => 0]);
        $quarterly = new BillingCycle(['months' => 3, 'discount_percent' => 5]);
        $annual = new BillingCycle(['months' => 12, 'discount_percent' => 15]);

        // Sin descuento vale exactamente lo que dice el plan, como hasta hoy.
        $this->assertSame(149990, MembershipPricing::priceFor($plan, $monthly));
        // 149.990 × 3 × 0,95 = 427.471,50 → 428.000
        $this->assertSame(428000, MembershipPricing::priceFor($plan, $quarterly));
        // 149.990 × 12 × 0,85 = 1.529.898 → 1.530.000
        $this->assertSame(1530000, MembershipPricing::priceFor($plan, $annual));
    }

    public function test_un_plan_sin_precio_no_tiene_precio_en_ningun_periodo(): void
    {
        $plan = $this->plan(['price_monthly' => null]);

        $this->assertNull(MembershipPricing::priceFor($plan, $this->monthly()));
    }

    /* ---------------------------------------------------------------- calendario */

    public function test_el_dia_del_vencimiento_todavia_esta_al_dia(): void
    {
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, Carbon::today());

        $this->artisan('membership:process')->assertSuccessful();

        $this->assertSame(Company::MEMBERSHIP_ACTIVE, $company->refresh()->membership_status);
    }

    public function test_vencida_ayer_pasa_a_gracia_con_su_fecha_limite(): void
    {
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, Carbon::today()->subDay());

        $this->artisan('membership:process')->assertSuccessful();

        $company->refresh();
        $this->assertSame(Company::MEMBERSHIP_GRACE, $company->membership_status);
        // Vencio ayer: deja de estar al dia hoy a las 00:00, mas los dias de gracia.
        $this->assertTrue($company->grace_ends_at->equalTo(Carbon::today()->addDays((int) config('membership.grace_days'))));
        $this->assertTrue($company->membershipEvents()->where('type', CompanyMembershipEvent::GRACE_STARTED)->exists());
    }

    public function test_la_gracia_agotada_suspende(): void
    {
        $company = $this->company(Company::MEMBERSHIP_GRACE, Carbon::today()->subDays(10), now()->subHour());

        $this->artisan('membership:process')->assertSuccessful();

        $this->assertSame(Company::MEMBERSHIP_SUSPENDED, $company->refresh()->membership_status);
    }

    public function test_la_simulacion_no_cambia_nada(): void
    {
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, Carbon::today()->subDay());

        $this->artisan('membership:process --dry-run')->assertSuccessful();

        $this->assertSame(Company::MEMBERSHIP_ACTIVE, $company->refresh()->membership_status);
    }

    public function test_el_nombre_viejo_del_comando_sigue_funcionando(): void
    {
        $this->artisan('membership:process-auto-debits --dry-run')->assertSuccessful();
    }

    /* -------------------------------------------------------------------- acceso */

    public function test_vencida_ya_no_bloquea_el_inicio_de_sesion_pero_inactiva_si(): void
    {
        $company = $this->company(Company::MEMBERSHIP_SUSPENDED, Carbon::today()->subMonth());

        $this->assertNull($company->corporateAuthenticationBlockReason());

        $company->is_active = false;
        $this->assertNotNull($company->corporateAuthenticationBlockReason());
    }

    public function test_una_suspendida_solo_puede_ir_a_mi_empresa(): void
    {
        $company = $this->company(Company::MEMBERSHIP_SUSPENDED, Carbon::today()->subMonth(), now()->subDays(20));
        $user = $this->userOf($company, ['dashboard.index.view', 'settings.index.view', 'productions.index.view']);

        $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('settings.index').'#membresia');
        $this->actingAs($user)->get(route('productions.index'))->assertRedirect(route('settings.index').'#membresia');
        $this->actingAs($user)->get(route('settings.index'))->assertOk();
    }

    public function test_en_gracia_trabaja_normal(): void
    {
        $company = $this->company(Company::MEMBERSHIP_GRACE, Carbon::today()->subDay(), now()->addDays(4));
        $user = $this->userOf($company, ['dashboard.index.view']);

        $this->actingAs($user)->get(route('dashboard'))->assertOk();
    }

    public function test_quien_no_ve_mi_empresa_recibe_la_pantalla_de_suspension(): void
    {
        $company = $this->company(Company::MEMBERSHIP_SUSPENDED, Carbon::today()->subMonth(), now()->subDays(20));
        $user = $this->userOf($company, ['dashboard.index.view']);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertStatus(402)
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Errors/Suspended')
                ->where('company', $company->name));
    }

    /* ------------------------------------------------------------------ cobros */

    public function test_el_pago_manual_renueva_un_periodo_y_reactiva(): void
    {
        $admin = $this->superAdmin();
        $company = $this->company(Company::MEMBERSHIP_SUSPENDED, Carbon::today()->subMonth(), now()->subDays(20));

        $this->actingAs($admin)
            ->post(route('companies.membership-payments.store', $company), ['note' => 'Transferencia'])
            ->assertSessionHasNoErrors();

        $company->refresh();
        $this->assertSame(Company::MEMBERSHIP_ACTIVE, $company->membership_status);
        $this->assertNull($company->grace_ends_at);
        // Venia suspendida: el periodo arranca hoy, no cuando vencio.
        $this->assertSame(Carbon::today()->addMonthNoOverflow()->toDateString(), $company->membership_ends_at->toDateString());

        $charge = CompanyBillingCharge::query()->where('company_id', $company->id)->sole();
        $this->assertSame(CompanyBillingCharge::STATUS_PAID, $charge->status);
        $this->assertSame(CompanyBillingCharge::METHOD_MANUAL, $charge->method);
        $this->assertStringStartsWith(CompanyBillingCharge::REFERENCE_PREFIX, (string) $charge->reference);
        $this->assertSame(150000.0, (float) $charge->amount);

        $types = $company->membershipEvents()->pluck('type')->all();
        $this->assertContains(CompanyMembershipEvent::RENEWED, $types);
        $this->assertContains(CompanyMembershipEvent::REACTIVATED, $types);
    }

    public function test_al_dia_el_pago_se_suma_al_final_del_periodo_vigente(): void
    {
        $endsAt = Carbon::today()->addDays(10);
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, $endsAt);

        app(MembershipService::class)->recordManualPayment($company, $this->superAdmin(), 'Efectivo');

        $this->assertSame($endsAt->copy()->addMonthNoOverflow()->toDateString(), $company->refresh()->membership_ends_at->toDateString());
    }

    public function test_aprobar_dos_veces_el_mismo_cobro_no_renueva_dos_veces(): void
    {
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, Carbon::today()->addDays(3));
        $service = app(MembershipService::class);

        $charge = $service->createPendingCharge($company, CompanyBillingCharge::METHOD_CHECKOUT, null);

        $this->assertTrue($service->approveCharge($charge, 'tx-1'));
        $endsAfterFirst = $company->refresh()->membership_ends_at->toDateString();

        $this->assertFalse($service->approveCharge($charge, 'tx-1'));
        $this->assertSame($endsAfterFirst, $company->refresh()->membership_ends_at->toDateString());
    }

    public function test_un_cobro_fallido_no_deshace_uno_pagado(): void
    {
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, Carbon::today()->addDays(3));
        $service = app(MembershipService::class);

        $charge = $service->createPendingCharge($company, CompanyBillingCharge::METHOD_CHECKOUT, null);
        $service->approveCharge($charge);
        $service->failCharge($charge, 'Evento viejo que llego tarde');

        $this->assertSame(CompanyBillingCharge::STATUS_PAID, $charge->refresh()->status);
    }

    /* ------------------------------------------------------------- super admin */

    public function test_alargar_el_vencimiento_desde_empresas_reactiva_y_queda_en_la_bitacora(): void
    {
        $admin = $this->superAdmin();
        $company = $this->company(Company::MEMBERSHIP_SUSPENDED, Carbon::today()->subMonth(), now()->subDays(20));
        $newEnd = Carbon::today()->addMonths(2)->toDateString();

        $this->actingAs($admin)
            ->put(route('companies.update', $company), [
                'name' => $company->name,
                'membership_plan_id' => $company->membership_plan_id,
                'billing_cycle_id' => $company->billing_cycle_id,
                'membership_started_at' => $company->membership_started_at->toDateString(),
                'membership_ends_at' => $newEnd,
                'membership_reason' => 'Acuerdo comercial',
            ])
            ->assertSessionHasNoErrors();

        $company->refresh();
        $this->assertSame(Company::MEMBERSHIP_ACTIVE, $company->membership_status);
        $this->assertSame($newEnd, $company->membership_ends_at->toDateString());

        $extension = $company->membershipEvents()->where('type', CompanyMembershipEvent::MANUAL_EXTENSION)->first();
        $this->assertNotNull($extension);
        $this->assertSame('Acuerdo comercial', $extension->data['reason']);
        $this->assertSame($admin->id, $extension->user_id);
    }

    public function test_crear_empresa_con_un_plan_de_prueba_arranca_en_prueba(): void
    {
        $admin = $this->superAdmin();
        $plan = $this->plan(['trial_days' => 14]);

        $this->actingAs($admin)
            ->post(route('companies.store'), ['name' => 'Taller de prueba '.Str::random(5), 'membership_plan_id' => $plan->id])
            ->assertSessionHasNoErrors();

        $company = Company::query()->where('membership_plan_id', $plan->id)->latest('id')->firstOrFail();

        $this->assertSame(Company::MEMBERSHIP_TRIAL, $company->membership_status);
        $this->assertSame(Carbon::today()->addDays(14)->toDateString(), $company->membership_ends_at->toDateString());
        $this->assertSame($this->monthly()->id, $company->billing_cycle_id);
    }

    public function test_crear_empresa_sin_prueba_ni_vencimiento_queda_activa_sin_fecha(): void
    {
        $admin = $this->superAdmin();
        $plan = $this->plan();

        $this->actingAs($admin)
            ->post(route('companies.store'), ['name' => 'Taller sin fecha '.Str::random(5), 'membership_plan_id' => $plan->id])
            ->assertSessionHasNoErrors();

        $company = Company::query()->where('membership_plan_id', $plan->id)->latest('id')->firstOrFail();

        // Como antes: sin fecha limite no hay tope temporal.
        $this->assertSame(Company::MEMBERSHIP_ACTIVE, $company->membership_status);
        $this->assertNull($company->membership_ends_at);
    }

    public function test_no_se_puede_desactivar_el_unico_periodo_activo(): void
    {
        $admin = $this->superAdmin();
        $monthly = $this->monthly();

        BillingCycle::query()->whereKeyNot($monthly->id)->update(['is_active' => false]);
        $monthly->update(['is_active' => true]);

        $this->actingAs($admin)
            ->post(route('super-admin.billing-cycles.toggle', $monthly))
            ->assertSessionHas('error');

        $this->assertTrue($monthly->refresh()->is_active);
    }

    public function test_no_se_borra_un_plan_que_tiene_empresas(): void
    {
        $admin = $this->superAdmin();
        $company = $this->company(Company::MEMBERSHIP_ACTIVE, null);

        $this->actingAs($admin)
            ->delete(route('super-admin.membership-plans.destroy', $company->membership_plan_id))
            ->assertSessionHas('error');

        $this->assertNotNull(MembershipPlan::query()->find($company->membership_plan_id));
    }

    public function test_mi_empresa_entrega_estado_periodo_y_precio(): void
    {
        $company = $this->company(Company::MEMBERSHIP_GRACE, Carbon::today()->subDay(), now()->addDays(4));
        $user = $this->userOf($company, ['settings.index.view']);

        $this->actingAs($user)
            ->get(route('settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('membership.status', Company::MEMBERSHIP_GRACE)
                ->where('membership.cycle.name', 'Mensual')
                ->where('membership.cycle_price', 150000)
                ->where('membership.quote.amount', 150000)
                ->has('membership.grace_ends_at'));
    }
}
