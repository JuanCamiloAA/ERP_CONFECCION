<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Icono de marca (favicon + login sin empresa)
    |--------------------------------------------------------------------------
    |
    | Por defecto se usa el objeto en Firebase Storage. Opcionalmente puede
    | poner una URL fija en BRAND_ICON_URL (p. ej. enlace con token estable)
    | o copiar el mismo PNG a public/{local_icon_path}.
    |
    */
    'icon_url' => env('BRAND_ICON_URL'),

    'firebase_icon_object' => env('BRAND_FIREBASE_ICON_OBJECT', 'App/Logo/mitallepro-icon-dark.png'),

    'local_icon_path' => 'images/mitallepro-icon-dark.png',

    /*
    |--------------------------------------------------------------------------
    | Correos
    |--------------------------------------------------------------------------
    |
    | Identidad y paleta que comparten TODOS los correos de la aplicacion a
    | traves de resources/views/emails/layout.blade.php. Cambiar un valor aqui
    | lo cambia en cada correo enviado: no hay colores sueltos en las vistas.
    |
    | El icono de marca del correo es un cuadro solido con un monograma, no una
    | imagen: Outlook y Gmail bloquean imagenes remotas por defecto y el
    | encabezado quedaria vacio en la primera apertura.
    |
    */
    'mail' => [

        'brand' => env('BRAND_MAIL_NAME', env('APP_NAME', 'MiTallerPro')),

        // Letra(s) del cuadro 36x36. Vacio = inicial del nombre de marca.
        'monogram' => env('BRAND_MAIL_MONOGRAM'),

        'address' => env('BRAND_MAIL_ADDRESS', 'Bogota, Colombia'),

        'support_email' => env('BRAND_MAIL_SUPPORT', env('MAIL_FROM_ADDRESS')),

        'legal' => env(
            'BRAND_MAIL_LEGAL',
            'Recibiste este correo porque tienes una cuenta activa en la plataforma.',
        ),

        /*
        | Dias que sigue abierto el enlace firmado al comprobante de nomina. El empleado no
        | tiene usuario en la plataforma: la firma de la URL es lo unico que autoriza la
        | descarga, asi que caduca en vez de quedar viva para siempre.
        */
        'receipt_link_days' => (int) env('BRAND_MAIL_RECEIPT_LINK_DAYS', 45),

        /*
        | Redes del pie. Solo se dibujan las que tengan URL configurada; si no
        | hay ninguna, la fila entera desaparece sin dejar hueco.
        */
        'social' => array_values(array_filter([
            ['label' => 'in', 'title' => 'LinkedIn', 'url' => env('BRAND_SOCIAL_LINKEDIN')],
            ['label' => 'f', 'title' => 'Facebook', 'url' => env('BRAND_SOCIAL_FACEBOOK')],
            ['label' => 'ig', 'title' => 'Instagram', 'url' => env('BRAND_SOCIAL_INSTAGRAM')],
            ['label' => 'wa', 'title' => 'WhatsApp', 'url' => env('BRAND_SOCIAL_WHATSAPP')],
        ], static fn (array $item): bool => is_string($item['url']) && $item['url'] !== '')),

        /*
        | Paleta Nocturne. Las vistas la leen con config('branding.mail.palette')
        | y la escriben inline en cada celda (los correos no heredan CSS).
        */
        'palette' => [
            'page' => '#101120',
            'card' => '#161826',
            'card_border' => '#292b31',
            'surface' => '#1c1e30',
            'surface_border' => '#2b2e3d',
            'text' => '#e9e9ed',
            'muted' => '#75798c',
            'subtle' => '#9aa0b5',
            'accent' => '#9184d9',
            'accent_soft' => '#d2cefd',
            'accent_bg' => '#2b2741',
            'hairline' => '#3f424d',
            'success' => '#5ee9a4',
            'success_bg' => '#152e24',
            'warning' => '#fbbf24',
            'warning_bg' => '#332612',
            'danger' => '#f87171',
            'danger_bg' => '#37191c',
            'font' => 'Inter, system-ui, Helvetica, Arial, sans-serif',
        ],
    ],

];
