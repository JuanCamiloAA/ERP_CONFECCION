<?php

namespace App\Services\Payments;

use App\Models\PaymentGatewayCredential;
use App\Models\PaymentGatewaySetting;

/**
 * De donde salen la configuracion y las credenciales de la pasarela.
 *
 * `payment_gateway_settings` guarda que entorno esta en uso y si los cobros estan
 * encendidos; `payment_gateway_credentials` guarda las cuatro llaves de cada entorno, por
 * separado. `config/wompi.php` (y por debajo el `.env`) solo rellena la primera vez, para
 * que un entorno recien clonado arranque con lo que ya tuviera puesto.
 *
 * Nace apagada: sin llaves no hay checkout que ofrecer, y es mejor un aviso claro que un
 * enlace de pago roto.
 */
class PaymentGatewayResolver
{
    public const PROVIDER = 'wompi';

    public function settings(): PaymentGatewaySetting
    {
        $row = PaymentGatewaySetting::query()->firstOrNew(['provider' => self::PROVIDER]);

        if (! $row->exists) {
            $row->environment = (string) config('wompi.environment', PaymentGatewaySetting::ENVIRONMENT_SANDBOX);
            $row->is_enabled = false;
            $row->save();

            // Lo del `.env` se siembra en el entorno que ese mismo `.env` declara.
            $seeded = $this->credential($row->environment);

            if (! $seeded->isComplete()) {
                $seeded->forceFill([
                    'public_key' => config('wompi.public_key'),
                    'private_key' => config('wompi.private_key'),
                    'events_secret' => config('wompi.events_secret'),
                    'integrity_secret' => config('wompi.integrity_secret'),
                ])->save();

                if ($seeded->isComplete()) {
                    $row->forceFill(['is_enabled' => true])->save();
                }
            }
        }

        return $row;
    }

    /** Credenciales de un entorno concreto; se crean vacias si aun no existen. */
    public function credential(string $environment): PaymentGatewayCredential
    {
        return PaymentGatewayCredential::query()->firstOrCreate([
            'provider' => self::PROVIDER,
            'environment' => $environment,
        ]);
    }

    public function wompi(): WompiService
    {
        $settings = $this->settings();

        return new WompiService($settings, $this->credential($settings->environment));
    }
}
