<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un periodo de pago de la membresia (mensual, trimestral...). Catalogo de plataforma.
 */
class BillingCycle extends Model
{
    protected $fillable = ['name', 'code', 'months', 'discount_percent', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return [
            'months' => 'integer',
            'discount_percent' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('months');
    }

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class);
    }

    /** El periodo con que nace una empresa si nadie elige otro; si lo desactivaron, el primero activo. */
    public static function default(): ?self
    {
        return self::query()->where('code', config('membership.default_cycle'))->first()
            ?? self::query()->active()->ordered()->first();
    }
}
