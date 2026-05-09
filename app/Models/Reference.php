<?php

namespace App\Models;

use App\Models\Concerns\ResolvesMediaUrlsInArray;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[ScopedBy([CompanyScope::class])]
class Reference extends Model
{
    use HasFactory, ResolvesMediaUrlsInArray, SoftDeletes;

    /**
     * @var list<string>
     */
    protected array $mediaUrlAttributes = ['image'];

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'payment_per_unit',
        'operational_cost_per_unit_fixed',
        'operational_lot_qty_at_cost_fix',
        'description',
        'image',
        'is_active',
        'lot_total_quantity',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'lot_total_quantity' => 'integer',
        'payment_per_unit' => 'decimal:2',
        'operational_cost_per_unit_fixed' => 'decimal:2',
        'operational_lot_qty_at_cost_fix' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function operations(): BelongsToMany
    {
        return $this->belongsToMany(Operation::class, 'reference_operations')
            ->withPivot(['id', 'price', 'is_active'])
            ->withTimestamps();
    }

    public function referenceOperations(): HasMany
    {
        return $this->hasMany(ReferenceOperation::class);
    }

    public function productions(): HasMany
    {
        return $this->hasMany(Production::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Costo operacional unitario fijado al crear la referencia (suma de precios de operaciones vinculadas en ese momento).
     * No depende del estado activo/inactivo posterior de las operaciones.
     */
    public function productionCostPerUnit(): float
    {
        return round((float) ($this->operational_cost_per_unit_fixed ?? 0), 2);
    }
}
