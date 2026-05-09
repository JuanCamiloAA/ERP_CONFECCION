<?php

/*
|--------------------------------------------------------------------------
| Ruta al JSON de cuenta de servicio
|--------------------------------------------------------------------------
|
| En .env puede ser ruta absoluta o relativa al directorio del proyecto
| (recomendado: storage/app/private/firebase/archivo.json).
|
*/
$envCredentialsPath = env('GOOGLE_APPLICATION_CREDENTIALS', '');
$resolvedCredentialsPath = '';

if (is_string($envCredentialsPath) && $envCredentialsPath !== '') {
    $trimmed = trim($envCredentialsPath);
    $isAbsolutePosix = str_starts_with($trimmed, '/');
    $isAbsoluteWindows = PHP_OS_FAMILY === 'Windows' && preg_match('#^[A-Za-z]:[/\\\\]#', $trimmed) === 1;
    $resolvedCredentialsPath = ($isAbsolutePosix || $isAbsoluteWindows)
        ? $trimmed
        : base_path(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim(str_replace('\\', '/', $trimmed), '/')));
}

return [

    'project_id' => env('FIREBASE_PROJECT_ID'),

    'storage_bucket' => env('FIREBASE_STORAGE_BUCKET'),

    /*
    |--------------------------------------------------------------------------
    | Credenciales de cuenta de servicio
    |--------------------------------------------------------------------------
    |
    | - credentials_path: archivo JSON (no subirlo al repositorio).
    | - credentials_json: opcional, JSON como una sola linea (p. ej. en PaaS).
    |
    */
    'credentials_path' => $resolvedCredentialsPath,

    'credentials_json' => env('FIREBASE_CREDENTIALS_JSON', ''),

    /*
    |--------------------------------------------------------------------------
    | URLs de lectura (objetos no publicos)
    |--------------------------------------------------------------------------
    |
    | Si las reglas de Storage no permiten lectura publica, hay que usar URLs
    | firmadas para <img src>. TTL maximo recomendable para V4: 7 dias.
    |
    */
    'use_signed_urls' => filter_var(env('FIREBASE_STORAGE_USE_SIGNED_URLS', '1'), FILTER_VALIDATE_BOOLEAN),

    'signed_url_ttl_seconds' => (int) env('FIREBASE_STORAGE_SIGNED_URL_TTL', 604800),

    'allowed_extensions' => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'],

];
