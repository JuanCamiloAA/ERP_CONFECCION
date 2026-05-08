<?php

return [
    'max_upload_kb' => (int) env('DATA_IMPORT_MAX_KB', 5120),

    'allowed_mimes' => [
        'text/csv',
        'text/plain',
        'text/x-csv',
        'application/csv',
        'application/vnd.ms-excel',
    ],

    /**
     * Conexión de cola para ProcessDataImportJob (p. ej. database, redis, sync).
     */
    'queue_connection' => env('DATA_IMPORT_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'database')),
];
