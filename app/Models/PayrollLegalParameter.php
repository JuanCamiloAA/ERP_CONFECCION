<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tramo de vigencia de jornada/recargos/horas extra/inasistencias (marco legal colombiano, ver
 * context/PROMPT_NOMINA_LEGAL_HORAS_RECARGOS.md §0 y §2.2). company_id null = parametro global de
 * sistema; una empresa con su propia fila para una fecha dada la usa en vez del global.
 */
class PayrollLegalParameter extends Model
{
    protected $fillable = [
        'company_id',
        'effective_from',
        'effective_to',
        'weekly_legal_hours',
        'monthly_hours_divisor',
        'night_start_time',
        'night_end_time',
        'night_surcharge_percent',
        'overtime_day_percent',
        'overtime_night_percent',
        'sunday_holiday_surcharge_percent',
        'max_overtime_hours_per_day',
        'max_overtime_hours_per_week',
        'discount_unexcused_absences',
        'absence_discount_percent',
        'legal_reference',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'weekly_legal_hours' => 'decimal:2',
        'monthly_hours_divisor' => 'decimal:2',
        'night_surcharge_percent' => 'decimal:2',
        'overtime_day_percent' => 'decimal:2',
        'overtime_night_percent' => 'decimal:2',
        'sunday_holiday_surcharge_percent' => 'decimal:2',
        'max_overtime_hours_per_day' => 'decimal:2',
        'max_overtime_hours_per_week' => 'decimal:2',
        'discount_unexcused_absences' => 'boolean',
        'absence_discount_percent' => 'decimal:2',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Filas visibles para una empresa: las suyas propias y la global (company_id null).
     * Null $companyId (super_admin, vista global) = solo las filas globales.
     */
    public function scopeForCompany(Builder $query, ?int $companyId): Builder
    {
        if (is_null($companyId)) {
            return $query->whereNull('company_id');
        }

        return $query->where(function (Builder $q) use ($companyId) {
            $q->where('company_id', $companyId)->orWhereNull('company_id');
        });
    }

    /**
     * Tramos que cubren una fecha (effective_from <= d <= effective_to o effective_to null).
     */
    public function scopeCovering(Builder $query, string $date): Builder
    {
        return $query->where('effective_from', '<=', $date)
            ->where(function (Builder $q) use ($date) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $date);
            });
    }
}
