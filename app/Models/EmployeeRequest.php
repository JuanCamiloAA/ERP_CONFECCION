<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Solicitud del empleado sobre su propia ficha.
 *
 * Nada de lo que pide se aplica al crearla: el dato vigente cambia solo cuando alguien
 * con permiso la aprueba. Esa es toda la razon de que exista la tabla —un operario no
 * escribe su cuenta bancaria ni su anticipo, los propone.
 */
#[ScopedBy([CompanyScope::class])]
class EmployeeRequest extends Model
{
    public const TYPE_ADVANCE = 'advance';

    public const TYPE_PROFILE_CHANGE = 'profile_change';

    public const TYPE_PRODUCTION_CORRECTION = 'production_correction';

    public const TYPES = [
        self::TYPE_ADVANCE,
        self::TYPE_PROFILE_CHANGE,
        self::TYPE_PRODUCTION_CORRECTION,
    ];

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'company_id',
        'employee_id',
        'requested_by',
        'type',
        'payload',
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    protected $casts = [
        'payload' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /** Etiqueta en español del tipo, para la bitacora y los listados. */
    public function typeLabel(): string
    {
        return match ($this->type) {
            self::TYPE_ADVANCE => 'Anticipo',
            self::TYPE_PROFILE_CHANGE => 'Cambio de cuenta bancaria',
            self::TYPE_PRODUCTION_CORRECTION => 'Corrección de producción',
            default => $this->type,
        };
    }
}
