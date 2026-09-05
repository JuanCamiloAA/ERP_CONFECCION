<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Throwable;

/**
 * Formato de cifras del comprobante, igual al de la pantalla.
 *
 * El comprobante en pantalla lo formatea `Intl.NumberFormat('es-CO')` en el navegador; el
 * PDF y el correo se arman en PHP. Sin un unico sitio que fije separador de miles, decimales
 * y simbolo, el mismo valor sale «$ 1.234.567» en la pantalla y «$1,234,567.00» en el correo.
 */
class ReceiptFormat
{
    /** Pesos sin decimales, salvo que el valor los tenga: «$ 1.234.567» / «$ 1.234,50». */
    public static function currency(mixed $value): string
    {
        $number = (float) ($value ?? 0);
        $decimals = fmod(round($number, 2), 1.0) === 0.0 ? 0 : 2;

        return '$ '.number_format($number, $decimals, ',', '.');
    }

    public static function number(mixed $value, int $decimals = 0): string
    {
        return number_format((float) ($value ?? 0), $decimals, ',', '.');
    }

    /** Horas con un decimal fijo («9,0»), para que la columna no salte de formato. */
    public static function hours(mixed $minutes): string
    {
        return number_format(((float) ($minutes ?? 0)) / 60, 1, ',', '.');
    }

    public static function date(mixed $value): string
    {
        if (blank($value)) {
            return '—';
        }

        try {
            return Carbon::parse($value)->format('d/m/Y');
        } catch (Throwable) {
            return '—';
        }
    }

    /** Hora corta de una marcacion; «—» cuando no hay. */
    public static function clock(mixed $value): string
    {
        if (blank($value)) {
            return '—';
        }

        try {
            return Carbon::parse($value)->format('H:i');
        } catch (Throwable) {
            return '—';
        }
    }
}
