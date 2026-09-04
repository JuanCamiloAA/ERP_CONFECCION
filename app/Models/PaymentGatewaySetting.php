<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

/**
 * Que entorno de la pasarela esta en uso y si los cobros estan encendidos.
 *
 * Las credenciales no viven aqui sino en `PaymentGatewayCredential`, una fila por entorno:
 * asi pruebas y produccion se configuran por separado y este selector solo decide cual de
 * los dos se usa, sin obligar a reescribir nada al cambiar.
 */
class PaymentGatewaySetting extends Model
{
    public const ENVIRONMENT_SANDBOX = 'sandbox';

    public const ENVIRONMENT_PRODUCTION = 'production';

    /** @var list<string> */
    public const ENVIRONMENTS = [self::ENVIRONMENT_SANDBOX, self::ENVIRONMENT_PRODUCTION];

    protected $fillable = [
        'provider',
        'environment',
        'is_enabled',
        'updated_by_user_id',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function credentials(): HasMany
    {
        return $this->hasMany(PaymentGatewayCredential::class, 'provider', 'provider');
    }

    /** Las credenciales del entorno que esta en uso. */
    public function activeCredential(): PaymentGatewayCredential
    {
        return PaymentGatewayCredential::query()->firstOrCreate([
            'provider' => $this->provider,
            'environment' => $this->environment,
        ]);
    }

    public function isSandbox(): bool
    {
        return $this->environment === self::ENVIRONMENT_SANDBOX;
    }

    /** Encendido y con las cuatro credenciales del entorno en uso cargadas. */
    public function isUsable(): bool
    {
        return $this->is_enabled && $this->activeCredential()->isComplete();
    }
}
