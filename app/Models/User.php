<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use App\Services\EffectivePermissionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Contracts\Permission as PermissionContract;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, HasRoles, Notifiable, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['avatar'];

    protected $fillable = [
        'company_id',
        'employee_id',
        'name',
        'last_name',
        'email',
        'password',
        'avatar',
        'phone',
        'is_active',
        'last_login_at',
        'password_change_required',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'password_change_required' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function permissionOverrides(): HasMany
    {
        return $this->hasMany(UserPermissionOverride::class);
    }

    /** @var list<string>|null */
    protected ?array $effectivePermissionNamesCache = null;

    public function flushEffectivePermissionCache(): void
    {
        $this->effectivePermissionNamesCache = null;
    }

    /**
     * @return list<string>
     */
    public function getEffectivePermissionNames(): array
    {
        if ($this->effectivePermissionNamesCache === null) {
            $this->effectivePermissionNamesCache = app(EffectivePermissionService::class)->getEffectivePermissionNames($this);
        }

        return $this->effectivePermissionNamesCache;
    }

    /**
     * @param  string|int|PermissionContract  $permission
     */
    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if ($permission instanceof PermissionContract) {
            $permission = $permission->getName();
        }

        if (! is_string($permission)) {
            return false;
        }

        $guard = $guardName ?? $this->getDefaultGuardName();

        if (! Permission::query()->where('name', $permission)->where('guard_name', $guard)->exists()) {
            return false;
        }

        return in_array($permission, $this->getEffectivePermissionNames(), true);
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->name ?? '').' '.($this->last_name ?? ''));
    }

    public function getInitialsAttribute(): string
    {
        $parts = explode(' ', trim($this->full_name));
        $initials = '';
        foreach ($parts as $p) {
            if ($p !== '') {
                $initials .= mb_strtoupper(mb_substr($p, 0, 1));
            }
            if (mb_strlen($initials) >= 2) {
                break;
            }
        }

        return $initials !== '' ? $initials : 'U';
    }

    public function isEmployee(): bool
    {
        return ! is_null($this->employee_id);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    public function isAdmin(): bool
    {
        return $this->hasAnyRole(['admin', 'super_admin']);
    }

    /**
     * Cuenta de operario: solo ve/registra su produccion (no administrador ni export global).
     */
    public function isRestrictedProductionAccount(): bool
    {
        return $this->isEmployee()
            && ! $this->isAdmin()
            && ! $this->can('productions.index.export');
    }

    public function scopeEmployees(Builder $query): Builder
    {
        return $query->whereNotNull('employee_id');
    }

    public function scopeStaff(Builder $query): Builder
    {
        return $query->whereNull('employee_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForCompany(Builder $query, int $companyId): Builder
    {
        return $query->where('company_id', $companyId);
    }

    public function getAccessiblePages(): array
    {
        if ($this->isSuperAdmin()) {
            $permissions = Permission::query()->orderBy('name')->pluck('name')->all();
        } else {
            $permissions = $this->getEffectivePermissionNames();
        }

        $pages = [];

        foreach ($permissions as $permission) {
            $parts = explode('.', $permission);
            if (count($parts) === 3 && $parts[2] === 'view') {
                $pages[] = $parts[0].'.'.$parts[1];
            }
        }

        return array_values(array_unique($pages));
    }
}
