<?php

namespace App\Support;

/**
 * Lista blanca de iconos Phosphor admitidos en los bloques de la landing.
 *
 * El editor guarda el nombre en formato "ph-nombre" y el frontend lo traduce al componente
 * de @phosphor-icons/react. Se valida contra esta lista para que un valor arbitrario no
 * llegue al render (icono inexistente) ni se use como vector de contenido no previsto.
 */
final class LandingIcons
{
    /**
     * @return list<string>
     */
    public static function allowed(): array
    {
        return [
            'ph-scissors',
            'ph-device-mobile',
            'ph-seal-check',
            'ph-receipt',
            'ph-buildings',
            'ph-lock-key',
            'ph-user-gear',
            'ph-currency-circle-dollar',
            'ph-clipboard-text',
            'ph-shield-check',
            'ph-calculator',
            'ph-magnifying-glass',
            'ph-squares-four',
            'ph-wifi-high',
            'ph-needle',
            'ph-users-three',
            'ph-chart-line-up',
            'ph-package',
            'ph-clock',
            'ph-check-circle',
        ];
    }

    public static function isAllowed(?string $icon): bool
    {
        return $icon !== null && in_array($icon, self::allowed(), true);
    }
}
