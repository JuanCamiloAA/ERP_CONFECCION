<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Seleccion de campos guardada para una plantilla de importacion.
 *
 * Cada usuario guarda las suyas; marcandolas como compartidas quedan visibles para los
 * demas super usuarios, que es el caso de «asi cargamos siempre los empleados aqui».
 * Las claves se validan contra el catalogo al leerlas, no al guardarlas: una columna que
 * desaparezca de la tabla no debe dejar el preset inservible.
 */
class DataImportFieldPreset extends Model
{
    protected $fillable = ['user_id', 'type', 'name', 'fields', 'is_shared'];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'is_shared' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
