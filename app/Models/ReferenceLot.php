<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Programacion ya cerrada de una referencia.
 *
 * Al reprogramar, la referencia pasa a la programacion siguiente y la que termina queda
 * aqui tal como estaba: su lote, su valor por unidad y el precio de cada operacion. La
 * programacion vigente no tiene fila: sus valores son los de la propia referencia.
 *
 * La produccion de cada programacion no se guarda aqui; se lee de `productions` por
 * `lot_number`, asi un registro que se corrige o se elimina despues se refleja solo.
 */
class ReferenceLot extends Model
{
    protected $fillable = [
        'reference_id',
        'lot_number',
        'lot_total_quantity',
        'payment_per_unit',
        'operational_cost_per_unit',
        'operations',
        'started_at',
        'ended_at',
        'closed_by',
    ];

    protected $casts = [
        'lot_number' => 'integer',
        'lot_total_quantity' => 'integer',
        'payment_per_unit' => 'decimal:2',
        'operational_cost_per_unit' => 'decimal:2',
        'operations' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function reference(): BelongsTo
    {
        return $this->belongsTo(Reference::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
