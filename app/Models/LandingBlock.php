<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Bloque de la landing publica. `data` es el borrador que edita el super usuario y
 * `published_data` lo que realmente ve el visitante; asi un cambio no sale al aire
 * hasta que se publica.
 */
class LandingBlock extends Model
{
    protected $fillable = ['type', 'position', 'is_visible', 'data', 'published_data'];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'published_data' => 'array',
            'is_visible' => 'boolean',
        ];
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position');
    }

    /** true cuando el borrador difiere de lo publicado (o nunca se ha publicado). */
    public function getIsDirtyAttribute(): bool
    {
        return $this->published_data === null || $this->data != $this->published_data;
    }
}
