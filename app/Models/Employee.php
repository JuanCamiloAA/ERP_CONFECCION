<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Employee extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['photo'];

    public const PAYROLL_MODE_OPERATIONS = 'operations';

    public const PAYROLL_MODE_FIXED_DAILY = 'fixed_daily';

    protected $fillable = [
        'company_id',
        'user_id',
        'first_name',
        'last_name',
        'document_type',
        'document_number',
        'phone',
        'email',
        'address',
        'hire_date',
        'photo',
        'base_salary',
        'payroll_mode',
        'daily_salary',
        'minutes_per_full_workday',
        'bank_id',
        'bank_account_number',
        'bank_key',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'base_salary' => 'decimal:2',
        'daily_salary' => 'decimal:2',
        'minutes_per_full_workday' => 'integer',
        'is_active' => 'boolean',
    ];

    protected $appends = ['full_name'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function payrollEmployees(): HasMany
    {
        return $this->hasMany(PayrollEmployee::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function workDaySessions(): HasMany
    {
        return $this->hasMany(WorkDaySession::class);
    }

    public function isPayrollByOperations(): bool
    {
        return ($this->payroll_mode ?? self::PAYROLL_MODE_OPERATIONS) === self::PAYROLL_MODE_OPERATIONS;
    }

    public function isPayrollFixedDaily(): bool
    {
        return ($this->payroll_mode ?? self::PAYROLL_MODE_OPERATIONS) === self::PAYROLL_MODE_FIXED_DAILY;
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''));
    }

    public function getInitialsAttribute(): string
    {
        $f = mb_substr($this->first_name ?? '', 0, 1);
        $l = mb_substr($this->last_name ?? '', 0, 1);

        return mb_strtoupper($f.$l) ?: 'E';
    }

    public function hasSystemAccess(): bool
    {
        return ! is_null($this->user_id) && optional($this->user)->is_active === true;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeWithAccess(Builder $query): Builder
    {
        return $query->whereNotNull('user_id');
    }
}
