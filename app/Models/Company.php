<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class Company extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['logo'];

    protected $fillable = [
        'name',
        'nit',
        'address',
        'phone',
        'email',
        'logo',
        'is_active',
        'settings',
        'membership_plan_id',
        'membership_started_at',
        'membership_ends_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'settings' => 'array',
        'membership_started_at' => 'datetime',
        'membership_ends_at' => 'datetime',
    ];

    public function membershipPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'membership_plan_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function references(): HasMany
    {
        return $this->hasMany(Reference::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(Operation::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function payrollConcepts(): HasMany
    {
        return $this->hasMany(PayrollConcept::class);
    }

    public function expenseCategories(): HasMany
    {
        return $this->hasMany(ExpenseCategory::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    /**
     * Fecha límite en maestro empresa: permite acceso ese día inclusivo y bloquea a partir del día siguiente.
     * Si no hay fecha, no hay tope temporal (solo cuenta is_active).
     */
    public function isMembershipEnded(?Carbon $today = null): bool
    {
        if ($this->membership_ends_at === null) {
            return false;
        }

        $today = ($today ?? Carbon::today())->copy()->startOfDay();
        $limit = Carbon::parse($this->membership_ends_at)->copy()->startOfDay();

        return $today->gt($limit);
    }

    /**
     * Motivo por el que un usuario de empresa NO puede autenticarse, o null si la empresa permite acceso corporativo.
     */
    public function corporateAuthenticationBlockReason(?Carbon $today = null): ?string
    {
        if (! $this->is_active) {
            return 'Tu empresa esta inactiva. Contacta al soporte.';
        }

        if ($this->isMembershipEnded($today)) {
            return 'El periodo configurado como fecha limite en el maestro de empresas ha vencido. Contacta al soporte para renovarlo.';
        }

        return null;
    }
}
