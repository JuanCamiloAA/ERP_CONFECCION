<?php

namespace Tests\Feature;

use App\Mail\LandingPlanInquiryMail;
use App\Models\BillingCycle;
use App\Models\LandingGlobal;
use App\Models\MembershipPlan;
use App\Services\Landing\LandingDataSources;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Seccion de planes de la landing: el precio de cada periodo sale del servidor, el mismo
 * calculo con que despues se cobra, y la solicitud de plan llega con el periodo elegido.
 */
class LandingPlansTest extends TestCase
{
    use DatabaseTransactions;

    protected function plan(array $overrides = []): MembershipPlan
    {
        return MembershipPlan::query()->create(array_merge([
            'name' => 'Plan landing',
            'slug' => 'plan-landing-'.Str::lower(Str::random(6)),
            'description' => 'Para talleres pequeños',
            'price_monthly' => 150000,
            'is_active' => true,
            'is_featured' => true,
            'trial_days' => 7,
        ], $overrides));
    }

    /**
     * @return array<string, mixed>
     */
    protected function rowFor(MembershipPlan $plan): array
    {
        $resolved = app(LandingDataSources::class)->resolve(['source' => 'membership_plans']);

        $this->assertNull($resolved['error']);

        return collect($resolved['rows'])->firstWhere('id', $plan->id);
    }

    public function test_cada_plan_trae_su_precio_en_cada_periodo_activo(): void
    {
        $plan = $this->plan();
        $row = $this->rowFor($plan);

        $this->assertSame('Para talleres pequeños', $row['description']);
        $this->assertTrue($row['is_featured']);
        $this->assertSame(7, $row['trial_days']);

        $prices = collect($row['prices'])->keyBy('code');
        $active = BillingCycle::query()->active()->pluck('code')->all();

        $this->assertEqualsCanonicalizing($active, $prices->keys()->all());

        if ($prices->has('trimestral')) {
            $this->assertSame(428000, $prices['trimestral']['price']);
            $this->assertSame(142666, $prices['trimestral']['monthly']);
        }

        if ($prices->has('mensual')) {
            $this->assertSame(150000, $prices['mensual']['price']);
        }
    }

    public function test_un_periodo_inactivo_no_sale_en_la_landing(): void
    {
        $plan = $this->plan();
        BillingCycle::query()->where('code', 'anual')->update(['is_active' => false]);

        $codes = collect($this->rowFor($plan)['prices'])->pluck('code')->all();

        $this->assertNotContains('anual', $codes);
    }

    public function test_un_plan_sin_precio_no_trae_precios_por_periodo(): void
    {
        $plan = $this->plan(['price_monthly' => null]);

        $row = $this->rowFor($plan);

        $this->assertSame([], $row['prices']);
        $this->assertNull($row['price']);
    }

    public function test_la_solicitud_de_plan_llega_con_el_periodo_elegido(): void
    {
        Mail::fake();

        $global = LandingGlobal::instance();
        $global->plan_inquiry_notify_email = 'ventas@example.com';
        $global->save();

        $plan = $this->plan();
        $cycle = BillingCycle::query()->active()->where('months', '>', 1)->firstOrFail();

        $this->post(route('landing.plan-inquiry'), [
            'company_name' => 'Confecciones La Prueba',
            'admin_full_name' => 'Ana Ruiz',
            'admin_email' => 'ana@example.com',
            'membership_plan_id' => $plan->id,
            'billing_cycle_id' => $cycle->id,
        ])->assertSessionHasNoErrors();

        Mail::assertSent(LandingPlanInquiryMail::class, fn (LandingPlanInquiryMail $mail) => $mail->plan?->is($plan)
            && $mail->cycle?->is($cycle)
            && str_contains($mail->render(), $cycle->name));
    }

    public function test_la_solicitud_sin_periodo_sigue_funcionando(): void
    {
        Mail::fake();

        $global = LandingGlobal::instance();
        $global->plan_inquiry_notify_email = 'ventas@example.com';
        $global->save();

        $plan = $this->plan();

        $this->post(route('landing.plan-inquiry'), [
            'company_name' => 'Confecciones La Prueba',
            'admin_full_name' => 'Ana Ruiz',
            'admin_email' => 'ana@example.com',
            'membership_plan_id' => $plan->id,
        ])->assertSessionHasNoErrors();

        Mail::assertSent(LandingPlanInquiryMail::class, fn (LandingPlanInquiryMail $mail) => $mail->cycle === null);
    }
}
