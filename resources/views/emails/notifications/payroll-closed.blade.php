@extends('emails.layout')

@section('title', 'Nomina pagada')
@section('eyebrow', 'Nomina')
@section('preheader', 'La nomina '.$payroll->name.' quedo marcada como pagada.')

@section('content')
    <x-mail.badge>Cierre de nomina</x-mail.badge>

    <x-mail.heading>{{ $payroll->name }} quedo pagada</x-mail.heading>

    <x-mail.text>
        Hola{{ $userName ? ' '.$userName : '' }}, la nomina del periodo
        {{ $payroll->period_start?->format('d/m/Y') }} – {{ $payroll->period_end?->format('d/m/Y') }}
        se marco como pagada. A partir de aqui su produccion y sus anticipos quedan cerrados.
    </x-mail.text>

    <x-mail.info-card title="Resumen">
        <x-mail.info-row label="Periodo" :value="$payroll->period_start?->format('d/m/Y').' – '.$payroll->period_end?->format('d/m/Y')" />
        <x-mail.info-row label="Empleados liquidados" :value="(string) $employeeCount" />
        <x-mail.info-row label="Total pagado" :value="'$ '.number_format($total, 0, ',', '.')" />
    </x-mail.info-card>

    <x-mail.button :url="$url" variant="solid">Ver la nomina</x-mail.button>

    <x-mail.text muted space="0">
        Recibes este aviso porque tienes activada la notificacion de cierre de nomina.
        Puedes apagarla en Mi perfil, en Preferencias de notificacion.
    </x-mail.text>
@endsection
