<?php

namespace App\Services\Landing;

use App\Services\Files\MediaUrlResolver;
use App\Support\LandingMediaUrl;

/**
 * Imagenes de los bloques de la landing.
 *
 * En la base se guarda la RUTA del archivo, nunca su URL: con Firebase la URL va firmada y
 * caduca (config firebase.signed_url_ttl_days), asi que una URL guardada dejaria la landing
 * sin imagenes a los pocos dias. La URL se calcula al leer y viaja en una clave hermana
 * `<campo>_url`, la misma convencion que usa LandingPayloadPresenter con los `*_path` del
 * CMS heredado; asi el editor puede reenviar el bloque completo sin pisar la ruta.
 *
 * Que campos son imagenes lo dicen los catalogos (config/landing_blocks.php y
 * config/landing_appearance.php), de modo que agregar uno nuevo no obliga a tocar esto.
 */
final class LandingBlockMedia
{
    public function __construct(private readonly MediaUrlResolver $resolver) {}

    /** Agrega las claves `<campo>_url` resueltas. Para lo que se envia al navegador. */
    public function present(string $type, array $data): array
    {
        return $this->apply($type, $data, true);
    }

    /** Quita las claves derivadas. Para lo que se guarda: en la base solo va la ruta. */
    public function strip(string $type, array $data): array
    {
        return $this->apply($type, $data, false);
    }

    private function apply(string $type, array $data, bool $resolve): array
    {
        $data = $this->walk((array) config("landing_blocks.$type.fields", []), $data, $resolve);

        if (isset($data['appearance']) && is_array($data['appearance'])) {
            $data['appearance'] = $this->walk($this->appearanceFields(), $data['appearance'], $resolve);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function walk(array $schema, array $values, bool $resolve): array
    {
        foreach ($schema as $key => $field) {
            $type = $field['type'] ?? 'text';

            if ($type === 'image') {
                // Lo derivado se descarta siempre; solo se vuelve a poner si toca resolver.
                unset($values[$key.'_url']);

                $path = $values[$key] ?? null;

                if ($resolve && is_string($path) && $path !== '') {
                    $values[$key.'_url'] = LandingMediaUrl::resolve($path, $this->resolver);
                }

                continue;
            }

            if ($type === 'repeater' && isset($values[$key]) && is_array($values[$key])) {
                foreach ($values[$key] as $i => $item) {
                    if (is_array($item)) {
                        $values[$key][$i] = $this->walk((array) ($field['item'] ?? []), $item, $resolve);
                    }
                }
            }
        }

        return $values;
    }

    /** Los ajustes de apariencia vienen agrupados por seccion; aqui se aplanan. */
    private function appearanceFields(): array
    {
        $fields = [];

        foreach ((array) config('landing_appearance', []) as $group) {
            foreach ((array) ($group['fields'] ?? []) as $key => $field) {
                $fields[$key] = $field;
            }
        }

        return $fields;
    }
}
