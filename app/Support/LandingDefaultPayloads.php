<?php

namespace App\Support;

use App\Models\LandingSection;

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
                'headline' => 'MiTallerCol: tu taller ordenado, de la producción a la nómina',
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
                'body' => "MiTallerCol nace para talleres de confección y manufactura ligera que necesitan orden operativo y nómina alineada a la realidad del piso.\n\nReunimos producción, personas y pagos en un solo flujo: menos hojas sueltas, menos discusiones sobre cifras y más claridad para administradores y operarios.",
                'image_path' => 'images/landing/about.svg',
            ],
            'header' => [
                'logo_type' => 'icon',
                'brand_icon' => 'ph-needle',
                'brand_image' => null,
                'brand' => 'ConfecciónERP',
                'links' => [
                    ['label' => 'Cómo funciona', 'url' => '#flow'],
                    ['label' => 'Módulos', 'url' => '#virtues'],
                    ['label' => 'Para quién', 'url' => '#audience'],
                    ['label' => 'Precios', 'url' => '#closing'],
                    ['label' => 'Ingresar', 'url' => '/login'],
                ],
                'cta' => ['label' => 'Vincular mi empresa', 'url' => '/register'],
            ],
            'footer' => [
                'copyright' => '© 2026 ConfecciónERP',
                'links' => [
                    ['label' => 'Términos', 'url' => '#'],
                    ['label' => 'Privacidad', 'url' => '#'],
                    ['label' => 'Soporte', 'url' => '#'],
                ],
            ],
            'hero_public' => [
                'tag' => 'Software para talleres de confección',
                'title' => 'Tu taller, con las cuentas claras cada quincena.',
                'body' => 'Vincula tu empresa y maneja producción a destajo, lotes por operación y nómina en un solo lugar. Tus datos, tus tarifas y tu gente quedan aislados de cualquier otro taller.',
                'primary' => ['label' => 'Vincular mi empresa', 'url' => '/register'],
                'secondary' => ['label' => 'Ver una demostración', 'url' => '/login'],
                'trust' => ['Sin instalación', 'Cada empresa con sus datos', 'Pensado para el celular del taller'],
            ],
            'flow' => [
                'kicker' => 'El flujo completo',
                'steps' => [
                    ['icon' => 'ph-scissors', 'title' => 'Referencia y lote', 'body' => 'Operaciones de la prenda y tarifa por unidad'],
                    ['icon' => 'ph-device-mobile', 'title' => 'Registro en el puesto', 'body' => 'Cada operaria marca lo que hizo, con tope de lote'],
                    ['icon' => 'ph-seal-check', 'title' => 'Confirmación del supervisor', 'body' => 'Lo registrado se valida antes de entrar a nómina'],
                    ['icon' => 'ph-receipt', 'title' => 'Nómina liquidada', 'body' => 'Producido, recargos, anticipos y comprobante'],
                ],
                'caption' => 'Un solo hilo: lo que se cose es lo que se paga.',
            ],
            'band' => [
                'title' => 'Multiempresa de verdad',
                'items' => [
                    ['icon' => 'ph-buildings', 'label' => 'Cada taller su propio espacio'],
                    ['icon' => 'ph-lock-key', 'label' => 'Datos aislados por empresa'],
                    ['icon' => 'ph-user-gear', 'label' => 'Roles y permisos propios'],
                    ['icon' => 'ph-currency-circle-dollar', 'label' => 'Tarifas y lotes propios'],
                ],
            ],
            'virtues' => [
                'kicker' => 'Por qué vincularte',
                'title' => 'Lo que cambia en el taller desde la primera semana',
                'cards' => [
                    ['icon' => 'ph-clipboard-text', 'title' => 'Se acaba la planilla de papel', 'body' => 'Lo que antes se anotaba en una hoja queda registrado en el puesto y no se pierde.'],
                    ['icon' => 'ph-shield-check', 'title' => 'Nadie cobra más de lo cortado', 'body' => 'El tope del lote por operación impide registrar más unidades de las que existen.'],
                    ['icon' => 'ph-calculator', 'title' => 'La quincena se cierra sola', 'body' => 'El producido, los recargos y los anticipos ya están sumados cuando llega el corte.'],
                    ['icon' => 'ph-magnifying-glass', 'title' => 'Toda cifra tiene origen', 'body' => 'De cada monto se puede volver al registro y a la persona que lo hizo.'],
                    ['icon' => 'ph-squares-four', 'title' => 'Cada rol ve lo suyo', 'body' => 'La operaria registra, el supervisor confirma y la administración liquida.'],
                    ['icon' => 'ph-wifi-high', 'title' => 'Funciona con lo que ya tienes', 'body' => 'Basta el celular del taller y una conexión sencilla; no hay que instalar nada.'],
                ],
            ],
            'audience' => [
                'kicker' => 'Para quién',
                'title' => 'Una sola herramienta, tres maneras de usarla',
                'roles' => [
                    ['tag' => 'Dueño', 'title' => 'Saber en qué va la plata', 'points' => ['Cuánto se produjo y cuánto se debe pagar', 'Qué referencias dejan margen', 'Cierres de quincena sin sorpresas']],
                    ['tag' => 'Jefe de planta', 'title' => 'Controlar el piso', 'points' => ['Avance de cada lote por operación', 'Quién está registrando y quién no', 'Confirmar antes de que entre a nómina']],
                    ['tag' => 'Operaria', 'title' => 'Que le cuenten lo que hizo', 'points' => ['Registrar desde el celular en segundos', 'Ver lo acumulado en la quincena', 'Anticipos descontados con claridad']],
                ],
            ],
            'steps_media' => [
                'kicker' => 'Vincularse toma una tarde',
                'steps' => [
                    ['number' => '01', 'title' => 'Creas la empresa', 'body' => 'Defines el taller, su administrador y los roles que va a usar.'],
                    ['number' => '02', 'title' => 'Cargas referencias y gente', 'body' => 'Referencias con sus operaciones y tarifas, y la lista de operarias.'],
                    ['number' => '03', 'title' => 'Cierras tu primera quincena', 'body' => 'Registras producción, confirmas y liquidas con comprobante.'],
                ],
                'image' => null,
                'image_caption' => 'Foto de taller — máquina plana o mesa de corte, fondo oscuro',
            ],
            'quote' => [
                'text' => '',
                'source' => '',
            ],
            'closing' => [
                'title' => 'Vincula tu taller y prueba con una línea',
                'body' => 'Empiezas con una referencia y un módulo. Si te cuadra la primera quincena, sigues con toda la planta.',
                'primary' => ['label' => 'Vincular mi empresa', 'url' => '/register'],
                'secondary' => ['label' => 'Hablar con el equipo', 'url' => '/login'],
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
            // Bloques del rediseno publico. Nacen ocultos (draft) para no alterar la landing
            // en linea sin que el super usuario los revise y publique.
            ['slug' => 'header', 'title_internal' => 'Encabezado y menú', 'sort_order' => 5, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'hero_public', 'title_internal' => 'Hero', 'sort_order' => 12, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'footer', 'title_internal' => 'Pie de página', 'sort_order' => 50, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'flow', 'title_internal' => 'Flujo completo', 'sort_order' => 15, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'band', 'title_internal' => 'Banda multiempresa', 'sort_order' => 22, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'virtues', 'title_internal' => 'Virtudes', 'sort_order' => 24, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'audience', 'title_internal' => 'Para quién', 'sort_order' => 32, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'steps_media', 'title_internal' => 'Pasos con imagen', 'sort_order' => 34, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'quote', 'title_internal' => 'Testimonio', 'sort_order' => 36, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
            ['slug' => 'closing', 'title_internal' => 'Cierre', 'sort_order' => 45, 'is_system' => true, 'initial_status' => LandingSection::STATUS_DRAFT],
        ];
    }
}
