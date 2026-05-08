<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'company_id',
        'action',
        'ip_address',
        'user_agent',
        'permission_checked',
        'result',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public static function log(string $action, ?int $userId = null, array $extra = []): self
    {
        $user = auth()->user();
        $request = request();

        return static::create(array_merge([
            'user_id' => $userId ?? $user?->id,
            'company_id' => $user?->company_id,
            'action' => $action,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'result' => 'allowed',
            'created_at' => now(),
        ], $extra));
    }
}
