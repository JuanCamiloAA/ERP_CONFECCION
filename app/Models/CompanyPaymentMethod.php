<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tarjeta con la que se cobra la membresia de una empresa.
 *
 * Solo guarda lo que la pasarela devuelve tras tokenizar. El numero completo y el CVC no
 * llegan a este modelo ni deben llegar: si algun dia aparecen en un `create()`, es un fallo
 * de la integracion, no un campo que falte aqui.
 */
class CompanyPaymentMethod extends Model
{
    protected $fillable = [
        'company_id',
        'gateway_token',
        'brand',
        'last4',
        'expiry_month',
        'expiry_year',
        'holder_name',
    ];

    protected $casts = [
        'expiry_month' => 'integer',
        'expiry_year' => 'integer',
    ];

    /**
     * El token es una credencial de cobro: no viaja al frontend ni a un log.
     *
     * @var list<string>
     */
    protected $hidden = ['gateway_token'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** «Visa ···· 4242», que es como se identifica una tarjeta sin exponerla. */
    public function getLabelAttribute(): string
    {
        return trim($this->brand.' ···· '.$this->last4);
    }

    /** MM/AA, el formato impreso en la propia tarjeta. */
    public function getExpiryLabelAttribute(): string
    {
        return str_pad((string) $this->expiry_month, 2, '0', STR_PAD_LEFT).'/'.substr((string) $this->expiry_year, -2);
    }
}
