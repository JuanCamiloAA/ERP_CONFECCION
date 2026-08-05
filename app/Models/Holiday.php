<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Festivo colombiano (o de otro country_code a futuro). No tiene company_id: es informacion
 * nacional compartida entre todas las empresas (ver §2.3 del prompt de nomina legal).
 */
class Holiday extends Model
{
    public const SOURCE_CALCULATED = 'calculated';

    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'country_code',
        'date',
        'name',
        'is_emiliani_shifted',
        'source',
    ];

    protected $casts = [
        'date' => 'date',
        'is_emiliani_shifted' => 'boolean',
    ];
}
