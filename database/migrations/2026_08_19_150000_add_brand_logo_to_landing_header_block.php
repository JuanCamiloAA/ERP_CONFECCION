<?php

use App\Models\LandingBlock;
use Illuminate\Database\Migrations\Migration;

/**
 * El logo del encabezado dejo de estar fijo en el codigo y pasa a ser contenido del
 * bloque: «logo_type» decide entre icono e imagen, «brand_icon» guarda el icono y
 * «brand_image» la ruta de la imagen. Se rellena con el icono que ya se venia dibujando
 * para que el sitio se vea igual y el editor abra con el valor correcto en vez de vacio.
 */
return new class extends Migration
{
    private const ANTERIOR = [
        'logo_type' => 'icon',
        'brand_icon' => 'ph-needle',
    ];

    public function up(): void
    {
        $this->cadaEncabezado(function (LandingBlock $block) {
            foreach (['data', 'published_data'] as $columna) {
                $payload = $block->{$columna};
                if (! is_array($payload)) {
                    continue;
                }

                // Solo se agrega lo que falta: un encabezado ya migrado no se pisa.
                $block->{$columna} = array_diff_key(self::ANTERIOR, $payload) + $payload;
            }

            $block->saveQuietly();
        });
    }

    public function down(): void
    {
        $this->cadaEncabezado(function (LandingBlock $block) {
            foreach (['data', 'published_data'] as $columna) {
                $payload = $block->{$columna};
                if (! is_array($payload)) {
                    continue;
                }

                $block->{$columna} = array_diff_key($payload, self::ANTERIOR + ['brand_image' => null, 'brand_image_url' => null]);
            }

            $block->saveQuietly();
        });
    }

    private function cadaEncabezado(callable $accion): void
    {
        LandingBlock::query()->where('type', 'header')->get()->each($accion);
    }
};
