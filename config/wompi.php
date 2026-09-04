<?php

/*
 * Pasarela de pagos Wompi.
 *
 * Estos valores son solo el respaldo: la configuracion viva la edita el super admin desde
 * la pantalla de Pasarela de pagos y se guarda cifrada en `payment_gateway_settings`. El
 * `.env` sirve para arrancar el proyecto y para entornos donde no se quiera tocar la base.
 *
 * Las llaves privadas y los secretos NO deben quedar en repositorio ni en logs.
 */
return [
    /** `sandbox` o `production`. Decide contra que host se firma y se consulta. */
    'environment' => env('WOMPI_ENVIRONMENT', 'production'),

    'public_key' => env('WOMPI_PUBLIC_KEY'),
    'private_key' => env('WOMPI_PRIVATE_KEY'),
    /** Secreto con el que Wompi firma los webhooks (`events`). */
    'events_secret' => env('WOMPI_EVENTS_SECRET'),
    /** Secreto con el que se firma el enlace del checkout (`integrity`). */
    'integrity_secret' => env('WOMPI_INTEGRITY_SECRET'),

    /*
     * Hosts oficiales. No se leen del entorno a proposito: apuntar el checkout a un host
     * arbitrario es la forma mas facil de que alguien se lleve los pagos.
     */
    'hosts' => [
        'sandbox' => 'https://sandbox.wompi.co/v1',
        'production' => 'https://production.wompi.co/v1',
    ],

    /** El checkout web es el mismo en ambos entornos; lo que cambia es la llave publica. */
    'checkout_url' => 'https://checkout.wompi.co/p/',

    /** Minutos que vive un enlace de pago antes de caducar. */
    'checkout_expiration_minutes' => 60,

    /** Horas que se guarda un registro pendiente sin pagar antes de poder limpiarse. */
    'signup_expiration_hours' => 24,
];
