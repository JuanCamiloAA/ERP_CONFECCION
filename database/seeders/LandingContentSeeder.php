<?php

namespace Database\Seeders;

use App\Models\LandingBlock;
use App\Models\LandingSection;
use App\Support\LandingDefaultPayloads;
use Illuminate\Database\Seeder;

/**
 * Contenido por defecto de la landing publica (instalacion limpia).
 *
 * Si el sitio ya tenia los bloques en la tabla anterior (landing_sections), se reutiliza
 * ese contenido en vez del de fabrica: asi una instalacion que ya estaba editada no pierde
 * los textos al pasar al modelo de landing_blocks.
 */
class LandingContentSeeder extends Seeder
{
    /** type del bloque => slug equivalente en la tabla anterior. */
    private const LEGACY_SLUG = [
        'header' => 'header',
        'hero' => 'hero_public',
        'flow' => 'flow',
        'band' => 'band',
        'virtues' => 'virtues',
        'audience' => 'audience',
        'steps_media' => 'steps_media',
        'quote' => 'quote',
        'closing' => 'closing',
        'footer' => 'footer',
    ];

    public function run(): void
    {
        $defaults = LandingDefaultPayloads::payloadBySlug();
        $legacy = $this->legacyPayloads();
        $position = 0;

        foreach (array_keys(config('landing_blocks')) as $type) {
            $position += 10;

            if (LandingBlock::query()->where('type', $type)->exists()) {
                continue;
            }

            $legacySlug = self::LEGACY_SLUG[$type] ?? $type;
            $data = $legacy[$legacySlug] ?? $defaults[$legacySlug] ?? [];

            LandingBlock::query()->create([
                'type' => $type,
                'position' => $position,
                // El testimonio nace oculto: queda listo para cuando haya uno real.
                'is_visible' => $type !== 'quote',
                'data' => $this->normalize($type, $data),
                'published_data' => null,
            ]);
        }
    }

    /**
     * Contenido ya editado en la tabla anterior, si existe.
     *
     * @return array<string, array<string, mixed>>
     */
    private function legacyPayloads(): array
    {
        if (! LandingSection::query()->getConnection()->getSchemaBuilder()->hasTable('landing_sections')) {
            return [];
        }

        return LandingSection::query()
            ->whereIn('slug', array_values(self::LEGACY_SLUG))
            ->get()
            ->mapWithKeys(fn (LandingSection $s) => [
                $s->slug => is_array($s->draft_payload) ? $s->draft_payload : (is_array($s->live_payload) ? $s->live_payload : []),
            ])
            ->all();
    }

    /**
     * Adapta la forma del contenido a la que espera el catalogo: los repeaters guardan
     * objetos {label}, mientras que el contenido anterior tenia listas de cadenas sueltas.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(string $type, array $data): array
    {
        $schema = config("landing_blocks.$type.fields", []);

        foreach ($schema as $key => $field) {
            if (($field['type'] ?? '') !== 'repeater') {
                continue;
            }

            $items = $data[$key] ?? [];
            if (! is_array($items)) {
                $data[$key] = [];

                continue;
            }

            $data[$key] = array_values(array_map(function ($item) use ($field) {
                if (is_string($item)) {
                    return ['label' => $item];
                }
                if (! is_array($item)) {
                    return [];
                }

                // Los puntos anidados de "audience" tambien pasan de cadena a {label}.
                foreach ($field['item'] ?? [] as $subKey => $sub) {
                    if (($sub['type'] ?? '') === 'repeater' && isset($item[$subKey]) && is_array($item[$subKey])) {
                        $item[$subKey] = array_values(array_map(
                            fn ($pt) => is_string($pt) ? ['label' => $pt] : (is_array($pt) ? $pt : []),
                            $item[$subKey]
                        ));
                    }
                }

                return $item;
            }, $items));
        }

        return $data;
    }
}
