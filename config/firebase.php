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

    'allowed_extensions' => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'],

    /*
    |--------------------------------------------------------------------------
    | URLs firmadas (lectura en navegador)
    |--------------------------------------------------------------------------
    |
    | Los objetos subidos con el Admin SDK no incluyen token de descarga de
    | Firebase; la URL ?alt=media sin firmar suele devolver 403. Las URLs
    | firmadas (V4) permiten mostrar imagenes hasta max. 7 dias (limite de GCS).
    |
    */
    'signed_url_ttl_days' => min(7, max(1, (int) env('FIREBASE_SIGNED_URL_TTL_DAYS', 7))),

];
