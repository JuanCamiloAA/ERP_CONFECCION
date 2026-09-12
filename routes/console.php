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

/*
 * Resumen semanal de produccion.
 *
 * Lunes temprano, cuando ya cerro la semana anterior y antes de que arranque el turno: es
 * el momento en que el dato sirve para decidir algo. Solo lo recibe quien tenga activada la
 * preferencia (ver NotificationPreferences).
 *
 * `withoutOverlapping` porque el envio es sincrono —el proyecto no tiene worker de colas— y
 * en una instalacion con muchas empresas la corrida puede alargarse.
 */
Schedule::command('notifications:weekly-production-digest')
    ->weeklyOn(1, '06:00')
    ->withoutOverlapping();
