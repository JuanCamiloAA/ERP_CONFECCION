<?php

namespace App\Services\Payments;

use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Integracion con Wompi (Colombia).
 *
 * Cubre lo que necesita el alta con pago: firmar el enlace del Checkout Web, verificar la
 * firma de los eventos que Wompi envia, y consultar una transaccion por id.
 *
 * Las tres cosas que no se negocian aqui:
 *
 * 1. Los hosts salen de `config/wompi.php`, nunca del formulario del super admin ni del
 *    entorno: apuntar el checkout a un host arbitrario es la forma mas facil de que
 *    alguien desvie los pagos.
 * 2. Un webhook no se cree por lo que dice: se valida su `checksum` con el secreto de
 *    eventos y, ademas, se vuelve a consultar la transaccion contra la API. Un `APPROVED`
 *    falsificado en el cuerpo daria de alta una empresa gratis.
 * 3. Ni las llaves ni los secretos entran en un log. Si algo falla se registra la
 *    referencia y el id de transaccion, que es lo que sirve para rastrear.
 *
 * Contrato verificado contra la documentacion de Wompi (septiembre 2026):
 * - Checkout: https://checkout.wompi.co/p/ con `public-key`, `currency`, `amount-in-cents`,
 *   `reference` y `signature:integrity`.
 * - Firma de integridad: SHA256 de "<referencia><monto><moneda><secreto>", y con
 *   "<referencia><monto><moneda><expiracion><secreto>" si se manda `expiration-time`.
 * - Eventos: SHA256 de los valores de `signature.properties` en orden, mas `timestamp`,
 *   mas el secreto de eventos.
 */
class WompiService
{
    /** Estados finales de una transaccion en Wompi. */
    public const STATUS_APPROVED = 'APPROVED';

    public const STATUS_DECLINED = 'DECLINED';

    public const STATUS_VOIDED = 'VOIDED';

    public const STATUS_ERROR = 'ERROR';

    public const STATUS_PENDING = 'PENDING';

    public function __construct(
        protected PaymentGatewaySetting $settings,
        protected PaymentGatewayCredential $credential,
    ) {}

    public function settings(): PaymentGatewaySetting
    {
        return $this->settings;
    }

    public function isUsable(): bool
    {
        return $this->settings->is_enabled && $this->credential->isComplete();
    }

    /** Base de la API segun el entorno configurado. */
    public function apiBase(): string
    {
        $hosts = config('wompi.hosts');

        return $hosts[$this->settings->environment] ?? $hosts['production'];
    }

    /**
     * Firma de integridad del enlace de pago.
     *
     * Sin ella Wompi rechaza el checkout, y con ella nadie puede cambiar el monto en la
     * URL: si lo tocan, la firma deja de cuadrar.
     */
    public function integritySignature(string $reference, int $amountInCents, string $currency, ?string $expiresAt = null): string
    {
        $secret = (string) $this->credential->integrity_secret;

        if ($secret === '') {
            throw new RuntimeException('Falta el secreto de integridad de Wompi.');
        }

        $payload = $reference.$amountInCents.$currency.($expiresAt ?? '').$secret;

        return hash('sha256', $payload);
    }

    /**
     * URL completa del Checkout Web para un cobro.
     *
     * @param  array<string, string|null>  $customer  email, full-name, phone-number, legal-id…
     */
    public function checkoutUrl(
        string $reference,
        int $amountInCents,
        string $currency,
        string $redirectUrl,
        array $customer = [],
        ?string $expiresAt = null,
    ): string {
        $params = [
            'public-key' => (string) $this->credential->public_key,
            'currency' => $currency,
            'amount-in-cents' => (string) $amountInCents,
            'reference' => $reference,
            'signature:integrity' => $this->integritySignature($reference, $amountInCents, $currency, $expiresAt),
            'redirect-url' => $redirectUrl,
        ];

        if ($expiresAt !== null) {
            $params['expiration-time'] = $expiresAt;
        }

        foreach (['email', 'full-name', 'phone-number', 'legal-id', 'legal-id-type'] as $field) {
            if (filled($customer[$field] ?? null)) {
                $params['customer-data:'.$field] = (string) $customer[$field];
            }
        }

        return config('wompi.checkout_url').'?'.http_build_query($params);
    }

    /**
     * Verifica la firma de un evento de Wompi.
     *
     * Se comparan los hashes con `hash_equals` y no con `===` para no filtrar por tiempo
     * cuanto se acerto del checksum.
     *
     * @param  array<string, mixed>  $payload  cuerpo JSON del webhook, ya decodificado
     */
    public function verifyEventSignature(array $payload): bool
    {
        $secret = (string) $this->credential->events_secret;
        $checksum = $payload['signature']['checksum'] ?? null;
        $properties = $payload['signature']['properties'] ?? null;
        $timestamp = $payload['timestamp'] ?? null;

        if ($secret === '' || ! is_string($checksum) || ! is_array($properties) || $timestamp === null) {
            return false;
        }

        $concatenated = '';

        foreach ($properties as $property) {
            if (! is_string($property)) {
                return false;
            }

            // Las propiedades vienen como rutas dentro de `data`: "transaction.id",
            // "transaction.status", "transaction.amount_in_cents".
            $value = data_get($payload['data'] ?? [], $property);

            if ($value === null) {
                return false;
            }

            $concatenated .= is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
        }

        $expected = hash('sha256', $concatenated.$timestamp.$secret);

        return hash_equals($expected, $checksum);
    }

    /**
     * Consulta una transaccion por id.
     *
     * Es la fuente de verdad: el webhook solo avisa de que algo cambio, y lo que se guarda
     * es lo que responde la API.
     *
     * @return array<string, mixed>|null
     */
    public function fetchTransaction(string $transactionId): ?array
    {
        try {
            $response = Http::withToken((string) $this->credential->public_key)
                ->acceptJson()
                ->timeout(15)
                ->retry(2, 300)
                ->get($this->apiBase().'/transactions/'.$transactionId);

            if (! $response->successful()) {
                Log::warning('Wompi: no se pudo consultar la transaccion.', [
                    'transaction_id' => $transactionId,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $data = $response->json('data');

            return is_array($data) ? $data : null;
        } catch (\Throwable $e) {
            // Sin credenciales en el mensaje: solo que fallo y contra que transaccion.
            Log::warning('Wompi: fallo la consulta de la transaccion.', [
                'transaction_id' => $transactionId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
