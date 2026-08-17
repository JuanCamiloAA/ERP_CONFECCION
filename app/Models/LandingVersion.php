<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Instantanea de todos los bloques al publicar, para poder restaurar. */
class LandingVersion extends Model
{
    protected $fillable = ['snapshot', 'published_by', 'note', 'published_at'];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
