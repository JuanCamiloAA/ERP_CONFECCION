<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    protected $fillable = [
        'name',
        'guard_name',
        'company_id',
        'display_name',
        'description',
        'color',
        'is_system',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function scopeForCompany(Builder $query, ?int $companyId): Builder
    {
        if (is_null($companyId)) {
            return $query->whereNull('company_id');
        }

        return $query->where(function (Builder $q) use ($companyId) {
            $q->where('company_id', $companyId)->orWhereNull('company_id');
        });
    }

    public function scopeCustom(Builder $query): Builder
    {
        return $query->where('is_system', false);
    }

    public function scopeSystem(Builder $query): Builder
    {
        return $query->where('is_system', true);
    }

    public function isEditable(): bool
    {
        return ! $this->is_system;
    }

    public function getUsersCountAttribute(): int
    {
        return \DB::table('model_has_roles')
            ->where('role_id', $this->id)
            ->where('model_type', User::class)
            ->count();
    }
}
