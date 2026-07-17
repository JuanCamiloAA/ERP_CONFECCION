<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DataImportBatch extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const TYPE_COMPANIES = 'companies';

    public const TYPE_BANKS = 'banks';

    public const TYPE_OPERATIONS = 'operations';

    public const TYPE_REFERENCES = 'references';

    public const TYPE_EMPLOYEES_USERS = 'employees_users';

    protected $fillable = [
        'user_id',
        'original_filename',
        'stored_path',
        'type',
        'status',
        'rows_total',
        'rows_success',
        'rows_failed',
        'error_report_path',
        'meta',
        'ip_address',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function types(): array
    {
        return [
            self::TYPE_COMPANIES,
            self::TYPE_BANKS,
            self::TYPE_OPERATIONS,
            self::TYPE_REFERENCES,
            self::TYPE_EMPLOYEES_USERS,
        ];
    }

    public function canBeProcessed(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_FAILED], true);
    }
}
