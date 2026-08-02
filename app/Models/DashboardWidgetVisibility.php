<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DashboardWidgetVisibility extends Model
{
    protected $table = 'dashboard_widget_visibility';

    protected $fillable = [
        'dashboard_widget_id',
        'company_id',
        'role_id',
        'position',
    ];

    protected $casts = [
        'position' => 'integer',
    ];

    public function widget(): BelongsTo
    {
        return $this->belongsTo(DashboardWidget::class, 'dashboard_widget_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
