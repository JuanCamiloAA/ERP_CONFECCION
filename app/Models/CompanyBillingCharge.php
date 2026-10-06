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
 *
 * Se crea `pendiente` ANTES de llamar a la pasarela: al reves, un cobro exitoso seguido de
 * una caida dejaria a la empresa cobrada sin rastro. La `reference` (MEM-...) es unica y es
 * lo que hace idempotente la liquidacion: un evento repetido no renueva dos veces.
 */
class CompanyBillingCharge extends Model
{
    public const STATUS_PENDING = 'pendiente';

    public const STATUS_PAID = 'pagado';

    /** Rechazado por la entidad o con error de la pasarela; `failure_reason` dice cual. */
    public const STATUS_FAILED = 'fallido';

    /** Anulado en la pasarela, o un enlace de pago que caduco sin pagarse. */
    public const STATUS_VOIDED = 'anulado';

    /** @var list<string> */
    public const STATUSES = [self::STATUS_PENDING, self::STATUS_PAID, self::STATUS_FAILED, self::STATUS_VOIDED];

    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'Pendiente',
        self::STATUS_PAID => 'Pagado',
        self::STATUS_FAILED => 'Fallido',
        self::STATUS_VOIDED => 'Anulado',
    ];

    /** Cobro a la tarjeta guardada (manual o de la renovacion automatica). */
    public const METHOD_SAVED_CARD = 'tarjeta';

    /** Checkout web de la pasarela: PSE, Nequi o tarjeta sin guardar. */
    public const METHOD_CHECKOUT = 'enlace';

    /** Pago recibido por fuera (transferencia, efectivo) que registra el super admin. */
    public const METHOD_MANUAL = 'manual';

    public const METHOD_LABELS = [
        self::METHOD_SAVED_CARD => 'Tarjeta guardada',
        self::METHOD_CHECKOUT => 'Pago en línea',
        self::METHOD_MANUAL => 'Registro manual',
    ];

    public const REFERENCE_PREFIX = 'MEM-';

    protected $fillable = [
        'company_id',
        'membership_plan_id',
        'billing_cycle_id',
        'amount',
        'currency',
        'concept',
        'reference',
        'status',
        'method',
        'period_starts_at',
        'period_ends_at',
        'gateway_reference',
        'attempts',
        'failure_reason',
        'charged_at',
        'paid_at',
        'created_by_user_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'attempts' => 'integer',
        'period_starts_at' => 'datetime',
        'period_ends_at' => 'datetime',
        'charged_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membershipPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class);
    }

    public function billingCycle(): BelongsTo
    {
        return $this->belongsTo(BillingCycle::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? (string) $this->status;
    }

    /** Pesos enteros a centavos, como los pide la pasarela. */
    public function amountInCents(): int
    {
        return (int) round(((float) $this->amount) * 100);
    }
}
