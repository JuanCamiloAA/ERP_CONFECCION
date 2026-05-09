<?php

use App\Models\LandingSection;
use App\Support\LandingDefaultPayloads;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        if (LandingSection::query()->where('slug', 'membership_plans')->exists()) {
            return;
        }

        $payload = LandingDefaultPayloads::payloadBySlug()['membership_plans'];

        LandingSection::query()->create([
            'slug' => 'membership_plans',
            'title_internal' => 'Planes de membresía (datos del sistema)',
            'sort_order' => 25,
            'status' => LandingSection::STATUS_LIVE,
            'is_system' => true,
            'published_at' => now(),
            'draft_payload' => $payload,
            'live_payload' => $payload,
        ]);
    }

    public function down(): void
    {
        LandingSection::query()->where('slug', 'membership_plans')->delete();
    }
};
