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
            ->withPivot(['id', 'price', 'estimated_minutes', 'difficulty_level', 'is_active'])
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
     * Costo operacional unitario: suma de los precios de las lineas activas de la referencia.
     *
     * Se lee de la columna, que se mantiene al dia con refreshOperationalCost(); asi el
     * listado de referencias muestra la cifra sin sumar el detalle de cada una.
     */
    public function productionCostPerUnit(): float
    {
        return round((float) ($this->operational_cost_per_unit_fixed ?? 0), 2);
    }

    /**
     * Recalcula y guarda el costo operacional unitario a partir del detalle de operaciones.
     *
     * Hay que llamarlo cada vez que cambian esas lineas — agregar, cambiar el precio,
     * activar o desactivar, quitar —, para que el comparativo economico refleje lo que
     * hoy cuesta producir una unidad y no lo que costaba al crear la referencia.
     *
     * Solo suman las lineas activas: una inactiva no se puede producir (el registro de
     * produccion solo ofrece las activas), asi que nunca llega a pagarse.
     *
     * El nombre de la columna conserva el sufijo `_fixed` de cuando el valor era una foto
     * del momento de la creacion; hoy es un valor derivado.
     */
    public function refreshOperationalCost(): void
    {
        $suma = (float) $this->referenceOperations()->where('is_active', true)->sum('price');

        $this->update(['operational_cost_per_unit_fixed' => round($suma, 2)]);
    }
}
