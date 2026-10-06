<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un renglon de la bitacora de membresia de una empresa. Solo se agrega, nunca se edita.
 */
class CompanyMembershipEvent extends Model
{
    public const UPDATED_AT = null;

    public const PROVISIONED = 'provisioned';

    public const PLAN_CHANGED = 'plan_changed';

    public const CYCLE_CHANGED = 'cycle_changed';

    public const RENEWED = 'renewed';

    public const GRACE_STARTED = 'grace_started';

    public const SUSPENDED = 'suspended';

    public const REACTIVATED = 'reactivated';

    public const MANUAL_EXTENSION = 'manual_extension';

    public const MANUAL_UPDATE = 'manual_update';

    public const CHARGE_FAILED = 'charge_failed';

    public const AUTO_RENEW_TOGGLED = 'auto_renew_toggled';

    public const LABELS = [
        self::PROVISIONED => 'Empresa creada',
        self::PLAN_CHANGED => 'Cambio de plan',
        self::CYCLE_CHANGED => 'Cambio de periodo de pago',
        self::RENEWED => 'Renovación',
        self::GRACE_STARTED => 'Entró en gracia',
        self::SUSPENDED => 'Suspendida',
        self::REACTIVATED => 'Reactivada',
        self::MANUAL_EXTENSION => 'Extensión manual',
        self::MANUAL_UPDATE => 'Ajuste manual',
        self::CHARGE_FAILED => 'Cobro fallido',
        self::AUTO_RENEW_TOGGLED => 'Renovación automática',
    ];

    protected $fillable = ['company_id', 'type', 'data', 'user_id', 'created_at'];

    protected function casts(): array
    {
        return ['data' => 'array', 'created_at' => 'datetime'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function label(): string
    {
        return self::LABELS[$this->type] ?? $this->type;
    }
}
