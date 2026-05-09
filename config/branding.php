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

];
