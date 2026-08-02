<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DashboardWidget extends Model
{
    public const TYPE_KPI = 'kpi';

    public const TYPE_BAR = 'bar';

    public const TYPE_LINE = 'line';

    public const TYPE_PIE = 'pie';

    public const TYPE_TABLE = 'table';

    public const QUERY_MODE_BUILDER = 'builder';

    public const QUERY_MODE_SQL = 'sql';

    protected $fillable = [
        'name',
        'title',
        'description',
        'type',
        'query_mode',
        'query_definition',
        'raw_sql',
        'chart_config',
        'refresh_interval_seconds',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'query_definition' => 'array',
        'chart_config' => 'array',
        'refresh_interval_seconds' => 'integer',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function visibility(): HasMany
    {
        return $this->hasMany(DashboardWidgetVisibility::class);
    }

    /**
     * Resuelve si este widget debe mostrarse a $user para la empresa efectiva $companyId.
     * Una fila con role_id nulo aplica a todos los roles de esa empresa.
     */
    public function isVisibleFor(User $user, ?int $companyId): bool
    {
        if (! $this->is_active || $companyId === null) {
            return false;
        }

        $roleIds = $user->roles->pluck('id')->all();

        return $this->visibility()
            ->where('company_id', $companyId)
            ->where(function ($q) use ($roleIds) {
                $q->whereNull('role_id');
                if ($roleIds !== []) {
                    $q->orWhereIn('role_id', $roleIds);
                }
            })
            ->exists();
    }
}
