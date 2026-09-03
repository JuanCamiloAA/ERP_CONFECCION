<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Renovacion automatica de la membresia.
 *
 * Queda programado desde ya para que el dia que se conecte la pasarela no haya que acordarse
 * de esto: hoy el comando solo crea la fila del cobro en estado «pendiente» y avisa; no
 * mueve dinero. TODO: conectar pasarela (ver ProcessMembershipAutoDebits::handle()).
 *
 * `withoutOverlapping` porque una corrida lenta y la del dia siguiente cobrarian dos veces
 * a la misma empresa.
 */
Schedule::command('membership:process-auto-debits')
    ->dailyAt('03:00')
    ->withoutOverlapping();
