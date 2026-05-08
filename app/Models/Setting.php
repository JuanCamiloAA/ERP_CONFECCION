<?php

namespace App\Models;

use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[ScopedBy([CompanyScope::class])]
class Setting extends Model
{
    protected $fillable = [
        'company_id',
        'key',
        'value',
        'group',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public static function get(string $key, mixed $default = null, ?int $companyId = null): mixed
    {
        $query = static::query();

        if ($companyId) {
            $query->withoutGlobalScopes()->where('company_id', $companyId);
        }

        $row = $query->where('key', $key)->first();

        return $row?->value ?? $default;
    }

    public static function set(string $key, mixed $value, ?int $companyId = null, string $group = 'general'): self
    {
        $companyId = $companyId ?? auth()->user()?->company_id;

        return static::withoutGlobalScopes()->updateOrCreate(
            ['company_id' => $companyId, 'key' => $key],
            ['value' => is_scalar($value) ? (string) $value : json_encode($value), 'group' => $group]
        );
    }
}
