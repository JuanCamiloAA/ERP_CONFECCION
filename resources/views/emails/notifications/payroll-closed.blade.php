@extends('emails.layout')

{{--
  El mismo aviso lo reciben el administrador y el empleado, con distinto contenido:
  `$total` y `$employeeCount` llegan en nulo para quien no tenga permiso de ver los
  totales de la nomina, y `$ownNet` solo lo trae quien aparece liquidado en ella. La vista
  no decide nada: `AccountNotifier::payrollClosed()` ya resolvio que puede ver cada uno.
--}}
@php
    $periodo = $payroll->period_start?->format('d/m/Y').' – '.$payroll->period_end?->format('d/m/Y');
    $soloLoSuyo = $ownNet !== null && $total === null;
@endphp

@section('title', $soloLoSuyo ? 'Tu pago de la nomina' : 'Nomina pagada')
@section('eyebrow', 'Nomina')
@section('preheader', $soloLoSuyo
    ? 'Tu liquidacion de '.$payroll->name.' quedo pagada.'
    : 'La nomina '.$payroll->name.' quedo marcada como pagada.')

@section('content')
    <x-mail.badge>Cierre de nomina</x-mail.badge>

    <x-mail.heading>{{ $payroll->name }} quedo pagada</x-mail.heading>

    @if($soloLoSuyo)
        <x-mail.text>
            Hola{{ $userName ? ' '.$userName : '' }}, la nomina del periodo {{ $periodo }} quedo pagada.
            Abajo esta tu neto del periodo; el detalle —produccion, jornadas, conceptos y anticipos—
            lo encuentras en tu comprobante.
        </x-mail.text>
    @else
        <x-mail.text>
            Hola{{ $userName ? ' '.$userName : '' }}, la nomina del periodo {{ $periodo }}
            se marco como pagada. A partir de aqui su produccion y sus anticipos quedan cerrados.
        </x-mail.text>
    @endif

    <x-mail.info-card title="Resumen">
        <x-mail.info-row label="Periodo" :value="$periodo" />
        @if($ownNet !== null)
            <x-mail.info-row label="Tu neto del periodo" :value="'$ '.number_format($ownNet, 0, ',', '.')" />
        @endif
        @if($employeeCount !== null)
            <x-mail.info-row label="Empleados liquidados" :value="(string) $employeeCount" />
        @endif
        @if($total !== null)
            <x-mail.info-row label="Total pagado" :value="'$ '.number_format($total, 0, ',', '.')" />
        @endif
    </x-mail.info-card>

    <x-mail.button :url="$url" variant="solid">{{ $soloLoSuyo ? 'Ver mi liquidacion' : 'Ver la nomina' }}</x-mail.button>

    <x-mail.text muted space="0">
        Recibes este aviso porque tienes activada la notificacion de cierre de nomina.
        Puedes apagarla en Mi perfil, en Preferencias de notificacion.
    </x-mail.text>
@endsection
