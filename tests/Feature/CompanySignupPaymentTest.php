<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanySignup;
use App\Models\MembershipPlan;
use App\Models\PaymentGatewaySetting;
use App\Models\User;
use App\Services\Payments\PaymentGatewayResolver;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Alta de empresa con pago del primer mes por Wompi.
 *
 * Nada de esto toca la red: `Http::fake()` responde por la API de Wompi. Lo que se protege
 * es que no exista forma de darse de alta sin pagar —ni falsificando el webhook, ni
 * pegando el id de otra transaccion, ni pagando de menos— y que un pago aprobado deje al
 * administrador con permisos de verdad, que es donde el registro anterior fallaba.
 *
 * Lo que escribe va dentro de una transaccion que se revierte al terminar.
 */
class CompanySignupPaymentTest extends TestCase
{
    use DatabaseTransactions;

    protected const EVENTS_SECRET = 'test_events_SECRETO';

    protected const INTEGRITY_SECRET = 'test_integrity_SECRETO';

    protected function setUp(): void
    {
        parent::setUp();

        // Ninguna prueba debe salir a internet; si alguna lo intenta, esto lo delata.
        Http::preventStrayRequests();

        $gateways = app(PaymentGatewayResolver::class);

        $settings = $gateways->settings();
        $settings->forceFill([
            'environment' => PaymentGatewaySetting::ENVIRONMENT_SANDBOX,
            'is_enabled' => true,
        ])->save();

        $gateways->credential(PaymentGatewaySetting::ENVIRONMENT_SANDBOX)->forceFill([
            'public_key' => 'pub_test_llave',
            'private_key' => 'prv_test_llave',
            'events_secret' => self::EVENTS_SECRET,
            'integrity_secret' => self::INTEGRITY_SECRET,
        ])->save();
    }

    protected function plan(): MembershipPlan
    {
        $plan = MembershipPlan::query()->where('is_active', true)->whereNotNull('price_monthly')->first();

        if ($plan === null) {
            $this->markTestSkipped('No hay planes de membresia con precio en esta base.');
        }

        return $plan;
    }

    protected function signupPayload(array $overrides = []): array
    {
        return array_merge([
            'membership_plan_id' => $this->plan()->id,
            'company_name' => 'Taller de Prueba SAS',
            'company_phone' => '+57 311 000 0000',
            'name' => 'Ana',
            'last_name' => 'Ruiz',
            'email' => 'alta-'.uniqid().'@ejemplo.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ], $overrides);
    }

    /** Transaccion tal como la devolveria la API de Wompi. */
    protected function transaction(CompanySignup $signup, string $status = 'APPROVED', array $overrides = []): array
    {
        return array_merge([
            'id' => 'TX-'.$signup->id,
            'reference' => $signup->reference,
            'status' => $status,
            'amount_in_cents' => $signup->amount_in_cents,
            'currency' => $signup->currency,
        ], $overrides);
    }

    protected function fakeTransaction(array $transaction): void
    {
        Http::fake([
            'sandbox.wompi.co/v1/transactions/*' => Http::response(['data' => $transaction], 200),
        ]);
    }

    /** Firma de evento tal como la calcula Wompi. */
    protected function eventPayload(array $transaction, int $timestamp = 1700000000, ?string $secret = null): array
    {
        $properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
        $concat = $transaction['id'].$transaction['status'].$transaction['amount_in_cents'];

        return [
            'event' => 'transaction.updated',
            'data' => ['transaction' => $transaction],
            'signature' => [
                'properties' => $properties,
                'checksum' => hash('sha256', $concat.$timestamp.($secret ?? self::EVENTS_SECRET)),
            ],
            'timestamp' => $timestamp,
        ];
    }

    /* ------------------------------------------------------------------ alta */

    public function test_la_pantalla_de_registro_ofrece_los_planes(): void
    {
        $this->get(route('register'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Auth/Register')
                ->has('plans')
                ->where('paymentsEnabled', true));
    }

    public function test_el_alta_no_crea_la_empresa_todavia_y_manda_al_checkout(): void
    {
        $payload = $this->signupPayload();

        $response = $this->post(route('register'), $payload);

        $signup = CompanySignup::query()->where('admin_email', $payload['email'])->firstOrFail();

        $this->assertSame(CompanySignup::STATUS_PENDING, $signup->status);
        $this->assertNull($signup->company_id);
        // Ni empresa ni usuario mientras no se pague.
        $this->assertDatabaseMissing('companies', ['name' => $payload['company_name']]);
        $this->assertDatabaseMissing('users', ['email' => $payload['email']]);

        // Inertia responde con una redireccion dura al checkout.
        $target = $response->headers->get('X-Inertia-Location') ?? $response->headers->get('Location');
        $this->assertNotNull($target);
        $this->assertStringStartsWith('https://checkout.wompi.co/p/', $target);

        parse_str(parse_url($target, PHP_URL_QUERY) ?: '', $query);

        $this->assertSame($signup->reference, $query['reference']);
        $this->assertSame((string) $signup->amount_in_cents, $query['amount-in-cents']);
        // El monto sale del plan, no del formulario.
        $this->assertSame((int) round(((float) $this->plan()->price_monthly) * 100), $signup->amount_in_cents);
    }

    public function test_el_enlace_de_pago_va_firmado_como_pide_wompi(): void
    {
        $payload = $this->signupPayload();
        $response = $this->post(route('register'), $payload);

        $target = $response->headers->get('X-Inertia-Location') ?? $response->headers->get('Location');
        parse_str(parse_url($target, PHP_URL_QUERY) ?: '', $query);

        $expected = hash(
            'sha256',
            $query['reference'].$query['amount-in-cents'].$query['currency'].$query['expiration-time'].self::INTEGRITY_SECRET,
        );

        $this->assertSame($expected, $query['signature:integrity']);
    }

    public function test_la_contrasena_no_se_guarda_en_claro_mientras_espera_el_pago(): void
    {
        $payload = $this->signupPayload();
        $this->post(route('register'), $payload);

        $stored = CompanySignup::query()->where('admin_email', $payload['email'])->value('admin_password');

        $this->assertNotSame($payload['password'], $stored);
        $this->assertTrue(Hash::check($payload['password'], $stored));
    }

    /* --------------------------------------------------------------- webhook */

    public function test_un_webhook_con_firma_invalida_no_da_de_alta_nada(): void
    {
        $signup = $this->pendingSignup();
        $transaction = $this->transaction($signup);

        $body = $this->eventPayload($transaction, secret: 'secreto_equivocado');

        $this->postJson(route('webhooks.wompi'), $body)->assertUnauthorized();

        $this->assertSame(CompanySignup::STATUS_PENDING, $signup->refresh()->status);
        $this->assertDatabaseMissing('companies', ['name' => $signup->company_name]);
    }

    public function test_un_webhook_aprobado_crea_la_empresa_y_el_administrador_con_permisos(): void
    {
        $signup = $this->pendingSignup();
        $transaction = $this->transaction($signup);
        $this->fakeTransaction($transaction);

        $this->postJson(route('webhooks.wompi'), $this->eventPayload($transaction))->assertOk();

        $signup->refresh();
        $this->assertSame(CompanySignup::STATUS_PAID, $signup->status);
        $this->assertNotNull($signup->company_id);

        $company = Company::query()->findOrFail($signup->company_id);
        $this->assertTrue((bool) $company->is_active);
        $this->assertSame($signup->membership_plan_id, $company->membership_plan_id);
        $this->assertNotNull($company->membership_ends_at);
        $this->assertSame(1, $company->billingCharges()->count());

        $admin = User::query()->where('email', $signup->admin_email)->firstOrFail();
        $admin->flushEffectivePermissionCache();

        // Lo que fallaba en el registro anterior: el rol se asignaba pero los permisos no.
        $this->assertContains('admin', $admin->roles->pluck('name')->all());
        $this->assertNotEmpty($admin->getEffectivePermissionNames());
        $this->assertTrue($admin->can('settings.index.view'));
    }

    public function test_dos_webhooks_del_mismo_pago_no_crean_dos_empresas(): void
    {
        $signup = $this->pendingSignup();
        $transaction = $this->transaction($signup);
        $this->fakeTransaction($transaction);

        $this->postJson(route('webhooks.wompi'), $this->eventPayload($transaction))->assertOk();
        $this->postJson(route('webhooks.wompi'), $this->eventPayload($transaction))->assertOk();

        $this->assertSame(1, Company::query()->where('name', $signup->company_name)->count());
        $this->assertSame(1, User::query()->where('email', $signup->admin_email)->count());
    }

    public function test_un_pago_rechazado_deja_el_alta_fallida_sin_crear_nada(): void
    {
        $signup = $this->pendingSignup();
        $transaction = $this->transaction($signup, 'DECLINED');
        $this->fakeTransaction($transaction);

        $this->postJson(route('webhooks.wompi'), $this->eventPayload($transaction))->assertOk();

        $this->assertSame(CompanySignup::STATUS_FAILED, $signup->refresh()->status);
        $this->assertDatabaseMissing('companies', ['name' => $signup->company_name]);
        $this->assertDatabaseMissing('users', ['email' => $signup->admin_email]);
    }

    public function test_pagar_de_menos_no_da_de_alta_la_empresa(): void
    {
        $signup = $this->pendingSignup();
        // Aprobada, pero por 1000 pesos en vez del precio del plan.
        $transaction = $this->transaction($signup, 'APPROVED', ['amount_in_cents' => 100000]);
        $this->fakeTransaction($transaction);

        $this->postJson(route('webhooks.wompi'), $this->eventPayload($transaction))->assertOk();

        $this->assertSame(CompanySignup::STATUS_FAILED, $signup->refresh()->status);
        $this->assertDatabaseMissing('companies', ['name' => $signup->company_name]);
    }

    public function test_el_estado_de_la_api_manda_sobre_el_del_evento(): void
    {
        $signup = $this->pendingSignup();

        // El evento dice APPROVED (con firma valida) pero la API dice DECLINED.
        $eventTransaction = $this->transaction($signup, 'APPROVED');
        $this->fakeTransaction($this->transaction($signup, 'DECLINED'));

        $this->postJson(route('webhooks.wompi'), $this->eventPayload($eventTransaction))->assertOk();

        $this->assertSame(CompanySignup::STATUS_FAILED, $signup->refresh()->status);
        $this->assertDatabaseMissing('companies', ['name' => $signup->company_name]);
    }

    /* ---------------------------------------------------- vuelta del checkout */

    public function test_la_vuelta_del_checkout_no_acepta_la_transaccion_de_otro_alta(): void
    {
        $signup = $this->pendingSignup();

        // Una transaccion aprobada, pero con la referencia de otro registro.
        $this->fakeTransaction([
            'id' => 'TX-AJENA',
            'reference' => 'ALTA-DE-OTRO',
            'status' => 'APPROVED',
            'amount_in_cents' => $signup->amount_in_cents,
            'currency' => 'COP',
        ]);

        $this->get(route('signup.status', ['reference' => $signup->reference, 'id' => 'TX-AJENA']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Auth/SignupStatus'));

        $this->assertSame(CompanySignup::STATUS_PENDING, $signup->refresh()->status);
        $this->assertDatabaseMissing('companies', ['name' => $signup->company_name]);
    }

    public function test_la_vuelta_del_checkout_confirma_el_pago_e_inicia_sesion(): void
    {
        $signup = $this->pendingSignup();
        $transaction = $this->transaction($signup);
        $this->fakeTransaction($transaction);

        $this->get(route('signup.status', ['reference' => $signup->reference, 'id' => $transaction['id']]))
            ->assertRedirect(route('dashboard'));

        $signup->refresh();
        $this->assertSame(CompanySignup::STATUS_PAID, $signup->status);

        $admin = User::query()->where('email', $signup->admin_email)->firstOrFail();
        $this->assertAuthenticatedAs($admin);
    }

    public function test_sin_pasarela_configurada_el_alta_avisa_en_vez_de_fallar(): void
    {
        $settings = app(PaymentGatewayResolver::class)->settings();
        $settings->forceFill(['is_enabled' => false])->save();

        $this->post(route('register'), $this->signupPayload())
            ->assertSessionHasErrors('membership_plan_id');

        $this->assertSame(0, CompanySignup::query()->where('company_name', 'Taller de Prueba SAS')->count());
    }

    /* -------------------------------------------------- pantalla super admin */

    public function test_las_credenciales_no_se_devuelven_a_la_pantalla(): void
    {
        $superAdmin = $this->superAdminOrSkip();

        $response = $this->actingAs($superAdmin)->get(route('super-admin.payment-gateway.index'));
        $response->assertOk();

        $json = json_encode($response->viewData('page')['props'], JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString(self::EVENTS_SECRET, $json);
        $this->assertStringNotContainsString(self::INTEGRITY_SECRET, $json);
        $this->assertStringNotContainsString('prv_test_llave', $json);

        // La llave publica si viaja: va en el enlace de pago de todos modos.
        $props = $response->viewData('page')['props'];
        $this->assertSame('pub_test_llave', $props['credentials']['sandbox']['public_key']);
        $this->assertTrue($props['credentials']['sandbox']['is_complete']);
    }

    public function test_cada_entorno_guarda_sus_propias_credenciales(): void
    {
        $superAdmin = $this->superAdminOrSkip();
        $gateways = app(PaymentGatewayResolver::class);

        // Se cargan las de produccion; las de pruebas no deben moverse.
        $this->actingAs($superAdmin)
            ->put(route('super-admin.payment-gateway.credentials.update', 'production'), [
                'public_key' => 'pub_prod_otra',
                'private_key' => 'prv_prod_otra',
                'events_secret' => 'prod_events_OTRO',
                'integrity_secret' => 'prod_integrity_OTRO',
            ])
            ->assertSessionHasNoErrors();

        $sandbox = $gateways->credential(PaymentGatewaySetting::ENVIRONMENT_SANDBOX);
        $production = $gateways->credential(PaymentGatewaySetting::ENVIRONMENT_PRODUCTION);

        $this->assertSame('pub_test_llave', $sandbox->public_key);
        $this->assertSame(self::EVENTS_SECRET, $sandbox->events_secret);
        $this->assertSame('pub_prod_otra', $production->public_key);
        $this->assertSame('prod_events_OTRO', $production->events_secret);
    }

    public function test_cada_formulario_valida_el_prefijo_de_su_propio_entorno(): void
    {
        $superAdmin = $this->superAdminOrSkip();

        // Una llave de pruebas en el bloque de pruebas es correcta, aunque el entorno en
        // uso fuera otro: es justo lo que la pantalla anterior rechazaba por error.
        $this->actingAs($superAdmin)
            ->put(route('super-admin.payment-gateway.credentials.update', 'sandbox'), ['public_key' => 'pub_test_valida'])
            ->assertSessionHasNoErrors();

        // Y una de pruebas en el bloque de produccion sigue estando mal.
        $this->actingAs($superAdmin)
            ->from(route('super-admin.payment-gateway.index'))
            ->put(route('super-admin.payment-gateway.credentials.update', 'production'), ['public_key' => 'pub_test_valida'])
            ->assertSessionHasErrors('public_key');
    }

    public function test_cambiar_de_entorno_usa_las_llaves_de_ese_entorno(): void
    {
        $superAdmin = $this->superAdminOrSkip();
        $gateways = app(PaymentGatewayResolver::class);

        $gateways->credential(PaymentGatewaySetting::ENVIRONMENT_PRODUCTION)->forceFill([
            'public_key' => 'pub_prod_viva',
            'private_key' => 'prv_prod_viva',
            'events_secret' => 'prod_events_VIVO',
            'integrity_secret' => 'prod_integrity_VIVO',
        ])->save();

        $this->actingAs($superAdmin)
            ->put(route('super-admin.payment-gateway.update'), ['environment' => 'production', 'is_enabled' => true])
            ->assertSessionHasNoErrors();

        $wompi = app(PaymentGatewayResolver::class)->wompi();

        $this->assertSame('https://production.wompi.co/v1', $wompi->apiBase());
        // La firma sale del secreto de produccion, no del de pruebas.
        $this->assertSame(
            hash('sha256', 'REF15000000COP'.'prod_integrity_VIVO'),
            $wompi->integritySignature('REF', 15000000, 'COP'),
        );
    }

    public function test_activar_los_cobros_sin_credenciales_del_entorno_avisa(): void
    {
        $superAdmin = $this->superAdminOrSkip();

        // Produccion esta vacia; encender los cobros ahi debe avisar, no romper.
        $this->actingAs($superAdmin)
            ->from(route('super-admin.payment-gateway.index'))
            ->put(route('super-admin.payment-gateway.update'), ['environment' => 'production', 'is_enabled' => true])
            ->assertSessionHasErrors('is_enabled');

        $this->assertSame(
            PaymentGatewaySetting::ENVIRONMENT_SANDBOX,
            app(PaymentGatewayResolver::class)->settings()->environment,
        );
    }

    protected function superAdminOrSkip(): User
    {
        $user = User::query()->get()->first(fn (User $u) => $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay super admin en esta base.');
        }

        return $user;
    }

    public function test_solo_el_super_admin_toca_las_credenciales(): void
    {
        $user = User::query()->whereNotNull('company_id')->get()->first(fn (User $u) => ! $u->isSuperAdmin());

        if ($user === null) {
            $this->markTestSkipped('No hay usuarios de empresa en esta base.');
        }

        $this->actingAs($user)->get(route('super-admin.payment-gateway.index'))->assertForbidden();
    }

    protected function pendingSignup(): CompanySignup
    {
        $plan = $this->plan();

        return CompanySignup::create([
            'reference' => 'ALTA-TEST-'.uniqid(),
            'membership_plan_id' => $plan->id,
            'company_name' => 'Taller Webhook SAS',
            'admin_name' => 'Ana',
            'admin_email' => 'webhook-'.uniqid().'@ejemplo.com',
            'admin_password' => Hash::make('Password123!'),
            'amount_in_cents' => (int) round(((float) $plan->price_monthly) * 100),
            'currency' => 'COP',
            'status' => CompanySignup::STATUS_PENDING,
            'expires_at' => now()->addDay(),
        ]);
    }
}
