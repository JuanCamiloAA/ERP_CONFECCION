<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Las cuatro credenciales de un entorno de la pasarela.
 *
 * Una fila por entorno (pruebas y produccion), de modo que cambiar de uno a otro no
 * obligue a reescribirlas. Los tres secretos van cifrados con la APP_KEY y `$hidden` los
 * saca de cualquier serializacion: es asi como acaban en un log sin que nadie lo quiera.
 */
class PaymentGatewayCredential extends Model
{
    protected $fillable = [
        'provider',
        'environment',
        'public_key',
        'private_key',
        'events_secret',
        'integrity_secret',
        'updated_by_user_id',
    ];

    protected $casts = [
        'private_key' => 'encrypted',
        'events_secret' => 'encrypted',
        'integrity_secret' => 'encrypted',
    ];

    /** @var list<string> */
    protected $hidden = ['private_key', 'events_secret', 'integrity_secret'];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    /** Sin las cuatro no se puede firmar el enlace ni validar el webhook. */
    public function isComplete(): bool
    {
        return filled($this->public_key)
            && filled($this->private_key)
            && filled($this->events_secret)
            && filled($this->integrity_secret);
    }

    /** Prefijo que Wompi le da a la llave publica de este entorno. */
    public function expectedPublicKeyPrefix(): string
    {
        return $this->environment === PaymentGatewaySetting::ENVIRONMENT_PRODUCTION ? 'pub_prod_' : 'pub_test_';
    }
}
