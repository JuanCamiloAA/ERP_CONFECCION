<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MembershipPlan extends Model
{
    protected $fillable = [
        'name',
        'description',
        'slug',
        'max_staff_users',
        'max_employees',
        'features_json',
        'price_monthly',
        'trial_days',
        'is_active',
        'is_featured',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features_json' => 'array',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'price_monthly' => 'decimal:2',
            'trial_days' => 'integer',
        ];
    }

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class, 'membership_plan_id');
    }
}
