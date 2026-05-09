<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[ScopedBy([CompanyScope::class])]
class PayrollEmployeeAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'payroll_employee_id',
        'payroll_concept_id',
        'amount',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function payrollEmployee(): BelongsTo
    {
        return $this->belongsTo(PayrollEmployee::class);
    }

    public function payrollConcept(): BelongsTo
    {
        return $this->belongsTo(PayrollConcept::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
