<?php

return [
    /** Disco local para reportes de error JSON (CSV va a Firebase si FILESYSTEM_DEFAULT_UPLOAD_DRIVER=firebase). */
    'disk' => 'imports',

    'max_upload_kb' => (int) env('DATA_IMPORT_MAX_KB', 5120),

    'allowed_mimes' => [
        'text/csv',
        'text/plain',
        'text/x-csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/octet-stream',
    ],

    /**
     * Conexión de cola para ProcessDataImportJob (p. ej. database, redis, sync).
     */
    'queue_connection' => env('DATA_IMPORT_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'database')),

    /** Intentos de importación CSV por minuto (solo super admin, tras validar archivo). */
    'rate_limit_per_minute' => (int) env('DATA_IMPORT_RATE_LIMIT_PER_MINUTE', 30),
];
