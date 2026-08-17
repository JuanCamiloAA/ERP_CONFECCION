<?php

namespace App\Models;

use App\Support\LandingDefaultPayloads;
use Illuminate\Database\Eloquent\Model;

class LandingSection extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_LIVE = 'live';

    protected $fillable = [
        'slug',
        'title_internal',
        'sort_order',
        'status',
        'is_system',
        'published_at',
        'draft_payload',
        'live_payload',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'published_at' => 'datetime',
            'draft_payload' => 'array',
            'live_payload' => 'array',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Crea las secciones de sistema definidas en {@see LandingDefaultPayloads::sectionDefinitions()}
     * que aún no existan (p. ej. tras añadir una sección nueva sin re-sembrar toda la landing).
     */
    public static function ensureSystemSectionsExist(): void
    {
        $payloads = LandingDefaultPayloads::payloadBySlug();

        foreach (LandingDefaultPayloads::sectionDefinitions() as $def) {
            $slug = $def['slug'];
            if (self::query()->where('slug', $slug)->exists()) {
                continue;
            }

            $payload = $payloads[$slug] ?? [];

            // Una seccion nueva puede nacer en borrador (initial_status) para que no aparezca
            // en la landing publicada hasta que el super usuario la revise y la publique.
            $status = $def['initial_status'] ?? self::STATUS_LIVE;
            $isLive = $status === self::STATUS_LIVE;

            self::query()->create([
                'slug' => $slug,
                'title_internal' => $def['title_internal'],
                'sort_order' => $def['sort_order'],
                'status' => $status,
                'is_system' => $def['is_system'],
                'published_at' => $isLive ? now() : null,
                'draft_payload' => $payload,
                'live_payload' => $isLive ? $payload : null,
            ]);
        }
    }
}
