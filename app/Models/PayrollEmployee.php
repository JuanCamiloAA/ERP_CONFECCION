<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollEmployee extends Model
{
    protected $fillable = [
        'payroll_id',
        'employee_id',
        'production_total',
        'daily_work_subtotal',
        'adjustments_subtotal',
        'validated_work_days',
        'deductions',
        'additions',
        'advances_discount',
        'net_payment',
        'is_paid',
        'paid_at',
        'notes',
    ];

    protected $casts = [
        'deductions' => 'array',
        'additions' => 'array',
        'validated_work_days' => 'array',
        'production_total' => 'decimal:2',
        'daily_work_subtotal' => 'decimal:2',
        'adjustments_subtotal' => 'decimal:2',
        'advances_discount' => 'decimal:2',
        'net_payment' => 'decimal:2',
        'is_paid' => 'boolean',
        'paid_at' => 'datetime',
    ];

    public function payroll(): BelongsTo
    {
        return $this->belongsTo(Payroll::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(PayrollEmployeeAdjustment::class);
    }
}
