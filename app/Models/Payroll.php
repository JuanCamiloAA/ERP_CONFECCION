<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Payroll extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_DRAFT = 'borrador';

    public const STATUS_CALCULATED = 'calculado';

    public const STATUS_APPROVED = 'aprobado';

    public const STATUS_PAID = 'pagado';

    public const TYPE_QUINCENAL = 'quincenal';

    public const TYPE_MENSUAL = 'mensual';

    protected $fillable = [
        'company_id',
        'name',
        'period_start',
        'period_end',
        'type',
        'status',
        'total_amount',
        'paid_at',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'paid_at' => 'datetime',
        'total_amount' => 'decimal:2',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function periodicity(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriodicity::class, 'type', 'code');
    }

    public function payrollEmployees(): HasMany
    {
        return $this->hasMany(PayrollEmployee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_CALCULATED]);
    }

    public function canBeCalculated(): bool
    {
        return ! in_array($this->status, [self::STATUS_APPROVED, self::STATUS_PAID]);
    }

    public function canBeApproved(): bool
    {
        return $this->status === self::STATUS_CALCULATED;
    }

    public function canBePaid(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Indica si una fecha (produccion) cae dentro del periodo de alguna nomina ya pagada de la empresa.
     */
    public static function paidPeriodCoversDate(int $companyId, \DateTimeInterface|string $date): bool
    {
        if ($companyId < 1) {
            return false;
        }

        $d = \Illuminate\Support\Carbon::parse($date)->toDateString();

        return static::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('status', self::STATUS_PAID)
            ->whereDate('period_start', '<=', $d)
            ->whereDate('period_end', '>=', $d)
            ->exists();
    }
}
