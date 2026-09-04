<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use App\Services\Payments\PaymentGatewayResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Credenciales y entorno de la pasarela de pagos. Solo super admin.
 *
 * Cada entorno tiene su propio formulario y su propio guardado: pruebas y produccion no
 * comparten llaves, de modo que se pueden dejar las dos cargadas y alternar con el
 * selector sin volver a teclear nada.
 *
 * Los secretos nunca se devuelven a la pantalla: solo si estan puestos y sus ultimos
 * caracteres, que es lo unico que hace falta para reconocer cual hay cargado. Al guardar,
 * un campo vacio significa «deja el que ya estaba».
 */
class PaymentGatewayController extends Controller
{
    /** @var list<string> */
    protected const SECRETS = ['private_key', 'events_secret', 'integrity_secret'];

    public function __construct(protected PaymentGatewayResolver $gateways) {}

    public function index(): Response
    {
        $settings = $this->gateways->settings();

        return Inertia::render('SuperAdmin/PaymentGateway/Index', [
            'settings' => [
                'provider' => $settings->provider,
                'environment' => $settings->environment,
                'is_enabled' => $settings->is_enabled,
                'is_usable' => $settings->isUsable(),
                'updated_at' => $settings->updated_at?->toIso8601String(),
                'updated_by' => $settings->updatedBy?->full_name,
            ],
            // Un bloque por entorno; el formulario de cada uno es independiente.
            'credentials' => collect(PaymentGatewaySetting::ENVIRONMENTS)
                ->mapWithKeys(fn (string $environment) => [
                    $environment => $this->credentialPayload($this->gateways->credential($environment)),
                ])
                ->all(),
            'webhookUrl' => route('webhooks.wompi'),
            'environments' => PaymentGatewaySetting::ENVIRONMENTS,
        ]);
    }

    /**
     * Guarda el entorno en uso y el interruptor de cobros. No toca credenciales.
     */
    public function update(Request $request): RedirectResponse
    {
        $settings = $this->gateways->settings();

        $data = $request->validate([
            'environment' => ['required', Rule::in(PaymentGatewaySetting::ENVIRONMENTS)],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $settings->environment = $data['environment'];
        $settings->is_enabled = (bool) $data['is_enabled'];
        $settings->updated_by_user_id = $request->user()?->id;

        // Encenderlo sin las credenciales del entorno elegido dejaria a los clientes con un
        // checkout que falla; se avisa aqui y no en la primera venta perdida.
        if ($settings->is_enabled && ! $this->gateways->credential($settings->environment)->isComplete()) {
            $label = $settings->environment === PaymentGatewaySetting::ENVIRONMENT_PRODUCTION ? 'producción' : 'pruebas';

            return back()->withErrors([
                'is_enabled' => "Faltan credenciales de {$label}: carga la llave pública, la privada y los dos secretos antes de activar los cobros.",
            ]);
        }

        $settings->save();

        return back()->with('success', 'Configuración de pagos guardada.');
    }

    /**
     * Guarda las credenciales de un entorno concreto.
     */
    public function updateCredentials(Request $request, string $environment): RedirectResponse
    {
        abort_unless(in_array($environment, PaymentGatewaySetting::ENVIRONMENTS, true), 404);

        $credential = $this->gateways->credential($environment);

        $data = $request->validate([
            'public_key' => ['nullable', 'string', 'max:191'],
            'private_key' => ['nullable', 'string', 'max:191'],
            'events_secret' => ['nullable', 'string', 'max:191'],
            'integrity_secret' => ['nullable', 'string', 'max:191'],
        ]);

        // El prefijo se comprueba contra el entorno de ESTE formulario, no contra el que
        // este en uso: una llave de pruebas en el bloque de pruebas es correcta aunque la
        // plataforma este cobrando en produccion.
        if (filled($data['public_key'] ?? null)) {
            $prefix = $credential->expectedPublicKeyPrefix();

            if (! str_starts_with(trim($data['public_key']), $prefix)) {
                return back()->withErrors([
                    'public_key' => "La llave pública de este entorno debería empezar por «{$prefix}».",
                ]);
            }

            $credential->public_key = trim($data['public_key']);
        }

        foreach (self::SECRETS as $field) {
            if (filled($data[$field] ?? null)) {
                $credential->{$field} = trim($data[$field]);
            }
        }

        $credential->updated_by_user_id = $request->user()?->id;
        $credential->save();

        $label = $environment === PaymentGatewaySetting::ENVIRONMENT_PRODUCTION ? 'producción' : 'pruebas';

        return back()->with('success', "Credenciales de {$label} guardadas.");
    }

    /**
     * @return array<string, mixed>
     */
    protected function credentialPayload(PaymentGatewayCredential $credential): array
    {
        return [
            'environment' => $credential->environment,
            'public_key' => $credential->public_key,
            'is_complete' => $credential->isComplete(),
            'expected_prefix' => $credential->expectedPublicKeyPrefix(),
            'updated_at' => $credential->updated_at?->toIso8601String(),
            // Nunca el valor: solo si hay algo y como termina, para poder distinguirlo.
            'secrets' => collect(self::SECRETS)
                ->mapWithKeys(fn (string $field) => [$field => $this->hint($credential->{$field})])
                ->all(),
        ];
    }

    /** «····abcd» si hay valor, null si no. Nunca el secreto entero. */
    protected function hint(?string $value): ?string
    {
        if (! filled($value)) {
            return null;
        }

        return '····'.substr($value, -4);
    }
}
