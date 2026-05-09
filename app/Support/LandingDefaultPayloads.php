<?php

namespace App\Support;

/**
 * Valores por defecto de secciones de la landing (reset + coherencia con LandingSeeder).
 */
final class LandingDefaultPayloads
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public static function payloadBySlug(): array
    {
        return [
            'hero' => [
                'headline' => 'MiTallerPro: tu taller ordenado, de la producción a la nómina',
                'subtext' => 'Software multiempresa para talleres de confección. Producción por empleado y operación, nómina por piezas o jornada, anticipos, roles por empresa y datos bancarios — todo centralizado y seguro.',
                'primary_cta_text' => 'Solicitar información',
                'primary_cta_url' => '/login',
                'secondary_cta_text' => 'Ver capacidades',
                'secondary_cta_url' => '#features',
                'background_image_path' => 'images/landing/hero-bg.svg',
                'background_image_alt' => 'Taller de confección',
                'banner_overlay_opacity' => 72,
            ],
            'features' => [
                'banner_image_path' => null,
                'banner_overlay_opacity' => 78,
                'items' => [
                    ['icon' => 'BuildingOffice2Icon', 'title' => 'Multiempresa', 'description' => 'Varias empresas en una sola instalación con aislamiento estricto de datos por compañía.'],
                    ['icon' => 'UsersIcon', 'title' => 'Producción por empleado', 'description' => 'Referencias, operaciones, cantidades y seguimiento de lo producido por persona y turno.'],
                    ['icon' => 'WrenchScrewdriverIcon', 'title' => 'Referencias y operaciones', 'description' => 'Catálogo de operaciones de confección y comparativa de costos frente al precio de pago unitario.'],
                    ['icon' => 'BanknotesIcon', 'title' => 'Nómina flexible', 'description' => 'Pago por operación y por salario diario con jornada (inicio y cierre de día) y validación administrativa.'],
                    ['icon' => 'CurrencyDollarIcon', 'title' => 'Anticipos y liquidaciones', 'description' => 'Anticipos, deducciones, liquidaciones e historial de producción y pagos.'],
                    ['icon' => 'IdentificationIcon', 'title' => 'Empleados y acceso', 'description' => 'Ficha de empleado, vínculo empleado–usuario y datos bancarios (banco, cuenta, llave).'],
                    ['icon' => 'ShieldCheckIcon', 'title' => 'Roles y permisos', 'description' => 'Roles por empresa con excepciones por usuario sin romper el rol compartido.'],
                    ['icon' => 'ChartBarIcon', 'title' => 'Reportes y tableros', 'description' => 'Producción, nómina y otros indicativos para tomar decisiones.'],
                    ['icon' => 'ArrowUpTrayIcon', 'title' => 'Carga masiva CSV', 'description' => 'Importación centralizada (super admin): empresas, bancos, operaciones, referencias y empleados con usuario.'],
                    ['icon' => 'CloudArrowUpIcon', 'title' => 'Archivos en la nube', 'description' => 'Imágenes y documentos con almacenamiento integrado (p. ej. Firebase Storage) y URLs firmadas.'],
                    ['icon' => 'CreditCardIcon', 'title' => 'Planes y límites', 'description' => 'Membresías por empresa con tope de usuarios de escritorio (staff), sin contar operarios con ficha de empleado.'],
                ],
            ],
            'partners' => [
                'banner_image_path' => null,
                'banner_overlay_opacity' => 0,
                'items' => [
                    ['name' => 'Cliente A', 'logo_path' => 'images/landing/partner-placeholder.svg', 'url' => '#', 'sort' => 0],
                    ['name' => 'Cliente B', 'logo_path' => 'images/landing/partner-placeholder.svg', 'url' => '#', 'sort' => 1],
                    ['name' => 'Cliente C', 'logo_path' => 'images/landing/partner-placeholder.svg', 'url' => '#', 'sort' => 2],
                    ['name' => 'Cliente D', 'logo_path' => 'images/landing/partner-placeholder.svg', 'url' => '#', 'sort' => 3],
                ],
            ],
            'about' => [
                'banner_image_path' => null,
                'banner_overlay_opacity' => 0,
                'title' => 'Hecho para talleres que viven de la producción',
                'body' => "MiTallerPro nace para talleres de confección y manufactura ligera que necesitan orden operativo y nómina alineada a la realidad del piso.\n\nReunimos producción, personas y pagos en un solo flujo: menos hojas sueltas, menos discusiones sobre cifras y más claridad para administradores y operarios.",
                'image_path' => 'images/landing/about.svg',
            ],
            'membership_plans' => [
                'banner_image_path' => null,
                'banner_overlay_opacity' => 0,
                'title' => 'Planes de membresía',
                'subtitle' => 'Precios y límites según el tamaño de tu taller. Los datos se actualizan automáticamente desde el sistema.',
                'footnote' => 'Los importes y condiciones pueden acordarse con el equipo comercial. Use “Solicitar este plan” o “Solicitar acceso” para contactar a un administrador.',
            ],
        ];
    }

    public static function payloadForSlug(string $slug): array
    {
        $all = self::payloadBySlug();

        return $all[$slug] ?? [
            'title' => '',
            'subtitle' => '',
            'body_markdown' => '',
            'banner_image_path' => null,
            'banner_overlay_opacity' => 0,
            'primary_cta_text' => null,
            'primary_cta_url' => null,
            'secondary_cta_text' => null,
            'secondary_cta_url' => null,
            'content_image_path' => null,
            'text_align' => 'left',
        ];
    }

    /**
     * Definición de secciones sistema para seeder / migración inicial.
     *
     * @return list<array{slug: string, title_internal: string, sort_order: int, is_system: bool}>
     */
    public static function sectionDefinitions(): array
    {
        return [
            ['slug' => 'hero', 'title_internal' => 'Hero', 'sort_order' => 10, 'is_system' => true],
            ['slug' => 'features', 'title_internal' => 'Features Grid', 'sort_order' => 20, 'is_system' => true],
            ['slug' => 'membership_plans', 'title_internal' => 'Planes de membresía (datos del sistema)', 'sort_order' => 25, 'is_system' => true],
            ['slug' => 'partners', 'title_internal' => 'Partners & Clientes', 'sort_order' => 30, 'is_system' => true],
            ['slug' => 'about', 'title_internal' => 'About', 'sort_order' => 40, 'is_system' => true],
        ];
    }
}
