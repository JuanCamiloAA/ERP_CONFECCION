<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Production extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_PENDING = 'pendiente';

    public const STATUS_CONFIRMED = 'confirmado';

    /**
     * Cerrada: entro en una nomina que ya se marco como pagada. Lo pone el sistema al
     * pagar la nomina, nunca el usuario, y saca el registro de las nominas siguientes.
     */
    public const STATUS_PAID = 'pagado';

    /** Estados que el usuario puede elegir a mano; `pagado` lo decide el cierre de nomina. */
    public const EDITABLE_STATUSES = [self::STATUS_PENDING, self::STATUS_CONFIRMED];

    /**
     * Estados que todavia puede liquidar una nomina. `pagado` queda fuera a proposito: es
     * lo que impide pagar dos veces la misma operacion.
     */
    public const PAYABLE_STATUSES = [self::STATUS_PENDING, self::STATUS_CONFIRMED];

    /** Produccion que ya conto como trabajo hecho: confirmada o ya pagada. */
    public const COUNTED_STATUSES = [self::STATUS_CONFIRMED, self::STATUS_PAID];

    protected $fillable = [
        'company_id',
        'employee_id',
        'reference_id',
        'operation_id',
        'quantity',
        'unit_price',
        'total_value',
        'date',
        'status',
        'shift',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_value' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saving(function (Production $production) {
            $production->total_value = round(((float) $production->quantity) * ((float) $production->unit_price), 2);
        });
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reference(): BelongsTo
    {
        return $this->belongsTo(Reference::class);
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeBetween(Builder $query, string $start, string $end): Builder
    {
        return $query->whereBetween('date', [$start, $end]);
    }

    public function scopeForEmployee(Builder $query, int $employeeId): Builder
    {
        return $query->where('employee_id', $employeeId);
    }
}
