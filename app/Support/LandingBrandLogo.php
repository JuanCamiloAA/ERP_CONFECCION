<?php

namespace App\Support;

use App\Models\LandingBlock;
use App\Services\Files\MediaUrlResolver;
use Throwable;

/**
 * Marca del producto: el logo que el super usuario elige en el editor de la landing.
 *
 * Es la marca general de la aplicacion — banner de acceso y barra lateral cuando no hay
 * contexto de empresa —, de modo que se cambia en un solo sitio. Donde si hay empresa, su
 * logo sigue mandando: esto es el respaldo, no un reemplazo.
 *
 * Se lee de `published_data` porque el borrador solo debe verse en la vista previa de la
 * landing; lo que ve el resto del sistema es lo publicado.
 *
 * @phpstan-type Logo array{type: string, icon: string, url: string|null}
 */
final class LandingBrandLogo
{
    private const ICONO_POR_DEFECTO = 'ph-needle';

    /**
     * @return Logo
     */
    public static function resolve(): array
    {
        try {
            $block = LandingBlock::query()->where('type', 'header')->first();
        } catch (Throwable) {
            // Instalacion sin migrar todavia: la aplicacion no puede quedarse sin marca.
            return self::icono(self::ICONO_POR_DEFECTO);
        }

        $data = $block?->published_data ?? $block?->data ?? [];
        if (! is_array($data)) {
            return self::icono(self::ICONO_POR_DEFECTO);
        }

        // Se valida contra la lista blanca aunque el editor ya lo haga: este valor sale de
        // la landing y termina dibujado en todas las pantallas.
        $icono = LandingIcons::isAllowed($data['brand_icon'] ?? null)
            ? (string) $data['brand_icon']
            : self::ICONO_POR_DEFECTO;

        if (($data['logo_type'] ?? '') === 'image') {
            $url = LandingMediaUrl::resolve($data['brand_image'] ?? null, app(MediaUrlResolver::class));

            // Eligio imagen pero no llego a subirla: mejor el icono que un hueco.
            if ($url !== null && $url !== '') {
                return ['type' => 'image', 'icon' => $icono, 'url' => $url];
            }
        }

        return self::icono($icono);
    }

    /**
     * @return Logo
     */
    private static function icono(string $icono): array
    {
        return ['type' => 'icon', 'icon' => $icono, 'url' => null];
    }
}
