<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alta de empresa a la espera del pago del primer mes.
 *
 * Deja de ser «pendiente» solo cuando Wompi confirma; hasta entonces no existe ni la
 * empresa ni el usuario.
 */
class CompanySignup extends Model
{
    public const STATUS_PENDING = 'pendiente';

    public const STATUS_PAID = 'pagado';

    public const STATUS_FAILED = 'fallido';

    public const STATUS_EXPIRED = 'expirado';

    protected $fillable = [
        'reference',
        'membership_plan_id',
        'company_name',
        'company_nit',
        'company_phone',
        'company_email',
        'admin_name',
        'admin_last_name',
        'admin_email',
        'admin_password',
        'amount_in_cents',
        'currency',
        'status',
        'transaction_id',
        'transaction_status',
        'paid_at',
        'expires_at',
        'company_id',
    ];

    protected $casts = [
        'amount_in_cents' => 'integer',
        'paid_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    /**
     * La contraseña ya hasheada no sale del modelo ni por accidente.
     *
     * @var list<string>
     */
    protected $hidden = ['admin_password'];

    public function membershipPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function hasExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
