<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Filtro de fechas del ranking que vale para toda la empresa.
 *
 * Hay como mucho una fila por empresa. Quien tiene `productions.ranking.filter_team.manage`
 * la crea o la quita; el resto la ve como banner y la usa de valor inicial.
 */
#[ScopedBy([CompanyScope::class])]
class ProductionRankingTeamFilter extends Model
{
    protected $fillable = [
        'company_id',
        'date_start',
        'date_end',
        'set_by_user_id',
    ];

    protected $casts = [
        'date_start' => 'date',
        'date_end' => 'date',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function setBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'set_by_user_id');
    }
}
