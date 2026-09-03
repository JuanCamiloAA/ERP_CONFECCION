<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un cobro de la membresia.
 *
 * El importe y el concepto se guardan en la fila, no se derivan del plan: un cobro es un
 * hecho historico y debe seguir diciendo lo mismo aunque el plan cambie de precio o
 * desaparezca del catalogo.
 */
class CompanyBillingCharge extends Model
{
    public const STATUS_PENDING = 'pendiente';

    public const STATUS_PAID = 'pagado';

    public const STATUS_FAILED = 'fallido';

    /** @var list<string> */
    public const STATUSES = [self::STATUS_PENDING, self::STATUS_PAID, self::STATUS_FAILED];

    protected $fillable = [
        'company_id',
        'membership_plan_id',
        'amount',
        'currency',
        'concept',
        'status',
        'gateway_reference',
        'charged_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'charged_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membershipPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class);
    }
}
