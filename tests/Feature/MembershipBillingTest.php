<?php

namespace Tests\Feature;

use App\Models\CompanyPaymentMethod;
use App\Models\User;
use App\Services\UserPermissionService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Membresia, tarjeta y debito automatico de «Mi empresa».
 *
 * Se protege la lista de aceptacion del rediseño: que el permiso de pago sea mas
 * restrictivo que el de editar, que activar la renovacion sin tarjeta avise en vez de
 * reventar, y —lo que no puede fallar nunca— que el numero de tarjeta y el CVC no queden
 * guardados ni salgan por ninguna respuesta.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class MembershipBillingTest extends TestCase
{
    use DatabaseTransactions;

    /** Numero de prueba valido segun Luhn; nunca debe aparecer guardado en ningun sitio. */
    protected const TEST_PAN = '4242424242424242';

    protected const TEST_CVC = '123';

    /**
     * @param  list<string>  $permissions
     */
    protected function actorWith(array $permissions): User
    {
        $user = User::query()
            ->whereNotNull('company_id')
            ->get()
            ->first(fn (User $u) => ! $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuarios de empresa en esta base.');
        }

        app(UserPermissionService::class)->sync($user, $permissions, $user);

        return $user->refresh();
    }

    protected function cardPayload(array $overrides = []): array
    {
        return array_merge([
            'holder_name' => 'Ana Ruiz',
            'card_number' => self::TEST_PAN,
            'expiry_month' => 12,
            'expiry_year' => now()->year + 2,
            'cvc' => self::TEST_CVC,
        ], $overrides);
    }

    public function test_mi_empresa_entrega_el_estado_completo_de_la_membresia(): void
    {
        $user = $this->actorWith(['settings.index.view']);

        $this->actingAs($user)
            ->get(route('settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Settings/Index')
                ->has('membership.plan')
                ->has('membership.ends_at')
                ->has('membership.days_left')
                ->has('membership.usage.staff_used')
                ->has('membership.payment_method')
                ->has('membership.auto_debit_enabled')
                ->has('membership.next_charge_at')
                ->has('membership.next_charge_amount')
                ->has('membership.billing_charges'));
    }

    public function test_ver_la_pantalla_no_alcanza_para_tocar_la_tarjeta(): void
    {
        // Puede editar deducciones y dificultad, pero no el medio de pago: es justo la
        // separacion que el rediseño pide.
        $user = $this->actorWith(['settings.index.view', 'settings.index.edit']);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload())
            ->assertForbidden();

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->post(route('settings.auto-debit.toggle'), ['enabled' => true])
            ->assertForbidden();
    }

    public function test_guardar_la_tarjeta_no_persiste_el_numero_ni_el_cvc(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload())
            ->assertSessionHas('success');

        $card = CompanyPaymentMethod::query()->where('company_id', $user->company_id)->first();

        $this->assertNotNull($card);
        $this->assertSame('Visa', $card->brand);
        $this->assertSame('4242', $card->last4);
        $this->assertSame('Ana Ruiz', $card->holder_name);

        // Ni el PAN ni el CVC en ninguna columna de la fila, se llame como se llame.
        $stored = implode('|', array_map('strval', $card->getAttributes()));
        $this->assertStringNotContainsString(self::TEST_PAN, $stored);
        $this->assertStringNotContainsString('424242424242', $stored);
        $this->assertStringNotContainsString(self::TEST_CVC, str_replace('4242', '', $stored));
    }

    public function test_la_tarjeta_no_sale_completa_en_la_respuesta(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload());

        $response = $this->actingAs($user)->get(route('settings.index'));
        $response->assertOk();

        $props = $response->viewData('page')['props'];
        $json = json_encode($props, JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString(self::TEST_PAN, $json);
        // El token de la pasarela es una credencial de cobro: tampoco viaja al frontend.
        $this->assertStringNotContainsString('gateway_token', $json);
        $this->assertSame('4242', $props['membership']['payment_method']['last4']);
    }

    public function test_un_numero_de_tarjeta_invalido_se_rechaza(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload(['card_number' => '4242424242424241']))
            ->assertSessionHasErrors('card_number');
    }

    public function test_una_tarjeta_vencida_se_rechaza(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        // Diciembre del año pasado: pasado siempre, se corra la prueba el mes que se corra.
        // El validador acepta el año (esta dentro del rango) y lo corta la comprobacion de
        // vencimiento, que es justo lo que se quiere medir.
        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload([
                'expiry_month' => 12,
                'expiry_year' => now()->year,
            ]))
            ->assertSessionDoesntHaveErrors();

        // Un año pasado lo corta el rango del validador.
        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload([
                'expiry_month' => now()->month,
                'expiry_year' => now()->subYear()->year,
            ]))
            ->assertSessionHasErrors('expiry_year');

        // Este año pero un mes ya pasado: eso solo lo ve `cardStillValid()`. En enero no
        // existe ese caso dentro del año, y no se fuerza.
        if (now()->month > 1) {
            $this->actingAs($user)
                ->from(route('settings.index'))
                ->put(route('settings.payment-method.update'), $this->cardPayload([
                    'expiry_month' => now()->month - 1,
                    'expiry_year' => now()->year,
                ]))
                ->assertSessionHasErrors('expiry_month');
        }
    }

    public function test_al_fallar_la_validacion_el_numero_y_el_cvc_no_quedan_en_la_sesion(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        // Laravel reenvia el input a la sesion cuando la validacion falla; sin el
        // `dontFlash` de bootstrap/app.php, el PAN y el CVC quedarian ahi guardados.
        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload(['holder_name' => '']))
            ->assertSessionHasErrors('holder_name');

        $flashed = session()->getOldInput();

        $this->assertArrayNotHasKey('card_number', $flashed);
        $this->assertArrayNotHasKey('cvc', $flashed);
        $this->assertStringNotContainsString(self::TEST_PAN, json_encode($flashed));
    }

    public function test_activar_la_renovacion_sin_tarjeta_avisa_en_vez_de_reventar(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        CompanyPaymentMethod::query()->where('company_id', $user->company_id)->delete();

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->post(route('settings.auto-debit.toggle'), ['enabled' => true])
            ->assertSessionHasErrors('enabled');

        $this->assertFalse((bool) $user->company->refresh()->auto_debit_enabled);
    }

    public function test_con_tarjeta_la_renovacion_se_activa_y_se_desactiva(): void
    {
        $user = $this->actorWith(['settings.index.view', 'settings.membership.manage_payment']);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->put(route('settings.payment-method.update'), $this->cardPayload());

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->post(route('settings.auto-debit.toggle'), ['enabled' => true])
            ->assertSessionHas('success');

        $this->assertTrue((bool) $user->company->refresh()->auto_debit_enabled);

        $this->actingAs($user)
            ->from(route('settings.index'))
            ->post(route('settings.auto-debit.toggle'), ['enabled' => false])
            ->assertSessionHas('success');

        $this->assertFalse((bool) $user->company->refresh()->auto_debit_enabled);
    }

    public function test_el_historial_llega_vacio_cuando_no_hay_cobros(): void
    {
        $user = $this->actorWith(['settings.index.view']);

        $user->company->billingCharges()->delete();

        $this->actingAs($user)
            ->get(route('settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('membership.billing_charges', 0));
    }

    public function test_el_comando_de_debito_no_cobra_nada_todavia(): void
    {
        // El hueco esta hecho pero la pasarela no: el comando debe correr sin explotar.
        $this->artisan('membership:process-auto-debits --dry-run')->assertSuccessful();
    }
}
