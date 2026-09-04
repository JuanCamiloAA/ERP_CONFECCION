<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\CompanySignup;
use App\Models\MembershipPlan;
use App\Models\User;
use App\Services\Payments\PaymentGatewayResolver;
use App\Services\Payments\SignupSettlementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Alta de empresa con pago del primer mes.
 *
 * El orden importa: los datos se guardan en `company_signups` y la empresa no existe
 * hasta que Wompi aprueba. Asi un checkout abandonado no deja empresas muertas ni ocupa
 * el correo de quien quiera reintentar.
 *
 * Quien confirma el pago de verdad es el webhook (`WompiWebhookController`). Esta pantalla
 * tambien comprueba al volver del checkout, porque el webhook puede tardar y el usuario
 * ya esta mirando: las dos rutas terminan en el mismo sitio y solo una llega a crear la
 * empresa, porque el alta se hace dentro de una transaccion sobre un registro bloqueado.
 */
class CompanySignupController extends Controller
{
    public function __construct(
        protected PaymentGatewayResolver $gateways,
        protected SignupSettlementService $settlements,
    ) {}

    public function create(): Response
    {
        return Inertia::render('Auth/Register', [
            'plans' => MembershipPlan::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'name', 'slug', 'price_monthly', 'max_staff_users', 'max_employees', 'features_json'])
                ->map(fn (MembershipPlan $plan) => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'price_monthly' => $plan->price_monthly !== null ? (float) $plan->price_monthly : null,
                    'max_staff_users' => $plan->max_staff_users,
                    'max_employees' => $plan->max_employees,
                    'features' => array_values($plan->features_json ?? []),
                ]),
            // Sin pasarela configurada no se ofrece un checkout que no va a funcionar.
            'paymentsEnabled' => $this->gateways->wompi()->isUsable(),
        ]);
    }

    /**
     * Guarda el alta pendiente y manda al checkout de Wompi.
     */
    public function store(Request $request): SymfonyResponse
    {
        $wompi = $this->gateways->wompi();

        if (! $wompi->isUsable()) {
            throw ValidationException::withMessages([
                'membership_plan_id' => 'Los pagos en línea no están disponibles en este momento. Intenta más tarde.',
            ]);
        }

        $data = $request->validate([
            'membership_plan_id' => ['required', 'integer', 'exists:membership_plans,id'],
            'company_name' => ['required', 'string', 'max:120'],
            'company_nit' => ['nullable', 'string', 'max:30', 'unique:companies,nit'],
            'company_phone' => ['nullable', 'string', 'max:30'],
            'company_email' => ['nullable', 'email', 'max:120'],
            'name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:120', 'unique:users,email'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $plan = MembershipPlan::query()
            ->where('is_active', true)
            ->findOr($data['membership_plan_id'], fn () => throw ValidationException::withMessages([
                'membership_plan_id' => 'El plan seleccionado no está disponible.',
            ]));

        if ($plan->price_monthly === null || (float) $plan->price_monthly <= 0) {
            throw ValidationException::withMessages([
                'membership_plan_id' => 'Ese plan no tiene precio configurado. Escríbenos para activarlo.',
            ]);
        }

        // El monto lo fija el servidor a partir del plan, nunca el formulario: si viniera
        // del cliente, cualquiera pagaria un peso por el plan mas caro.
        $amountInCents = (int) round(((float) $plan->price_monthly) * 100);
        $currency = 'COP';
        $reference = 'ALTA-'.now()->format('YmdHis').'-'.Str::upper(Str::random(10));

        $signup = CompanySignup::create([
            'reference' => $reference,
            'membership_plan_id' => $plan->id,
            'company_name' => $data['company_name'],
            'company_nit' => $data['company_nit'] ?? null,
            'company_phone' => $data['company_phone'] ?? null,
            'company_email' => $data['company_email'] ?? null,
            'admin_name' => $data['name'],
            'admin_last_name' => $data['last_name'] ?? null,
            'admin_email' => $data['email'],
            'admin_password' => Hash::make($data['password']),
            'amount_in_cents' => $amountInCents,
            'currency' => $currency,
            'status' => CompanySignup::STATUS_PENDING,
            'expires_at' => now()->addHours((int) config('wompi.signup_expiration_hours', 24)),
        ]);

        $expiresAt = now()
            ->addMinutes((int) config('wompi.checkout_expiration_minutes', 60))
            ->toIso8601ZuluString();

        $url = $wompi->checkoutUrl(
            $signup->reference,
            $amountInCents,
            $currency,
            route('signup.status', ['reference' => $signup->reference]),
            [
                'email' => $signup->admin_email,
                'full-name' => trim($signup->admin_name.' '.($signup->admin_last_name ?? '')),
                'phone-number' => $signup->company_phone,
            ],
            $expiresAt,
        );

        // Salida del dominio: Inertia necesita una redireccion dura, no una visita suya.
        return Inertia::location($url);
    }

    /**
     * Pantalla de vuelta del checkout.
     *
     * Wompi devuelve `?id=<transaccion>`. Se consulta esa transaccion contra la API —no se
     * confia en la URL— y, si esta aprobada, se crea la empresa aqui mismo por si el
     * webhook aun no ha llegado.
     */
    public function status(Request $request, string $reference): Response|RedirectResponse
    {
        $signup = CompanySignup::query()->where('reference', $reference)->firstOrFail();

        if ($signup->status === CompanySignup::STATUS_PENDING) {
            $transactionId = $request->query('id');

            if (is_string($transactionId) && $transactionId !== '') {
                $this->settleFromTransaction($signup, $transactionId);
                $signup->refresh();
            }
        }

        // Ya pagado: si nadie ha iniciado sesion todavia, se entra directo.
        if ($signup->status === CompanySignup::STATUS_PAID && $signup->company_id !== null) {
            if (! Auth::check()) {
                $admin = User::query()
                    ->where('company_id', $signup->company_id)
                    ->where('email', $signup->admin_email)
                    ->first();

                if ($admin) {
                    Auth::login($admin);
                    $request->session()->regenerate();

                    return redirect()
                        ->route('dashboard')
                        ->with('success', '¡Listo! Tu empresa quedó activa y el primer mes está pagado.');
                }
            }

            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/SignupStatus', [
            'reference' => $signup->reference,
            'status' => $signup->status,
            'transactionStatus' => $signup->transaction_status,
            'companyName' => $signup->company_name,
            'planName' => $signup->membershipPlan?->name,
            'amount' => $signup->amount_in_cents / 100,
            'currency' => $signup->currency,
            'expired' => $signup->hasExpired(),
        ]);
    }

    /**
     * Consulta la transaccion y, si esta aprobada, da de alta la empresa.
     *
     * Comparte camino con el webhook a proposito: los dos llaman a lo mismo y el bloqueo
     * de fila decide quien llega primero, de modo que una empresa no se crea dos veces.
     */
    protected function settleFromTransaction(CompanySignup $signup, string $transactionId): void
    {
        $transaction = $this->gateways->wompi()->fetchTransaction($transactionId);

        if ($transaction === null) {
            return;
        }

        // La transaccion tiene que ser de este alta: sin esta comprobacion, pegar en la URL
        // el id de un pago ajeno daria de alta la empresa sin haber pagado.
        if (($transaction['reference'] ?? null) !== $signup->reference) {
            return;
        }

        $this->settlements->settle($signup->reference, $transaction);
    }
}
