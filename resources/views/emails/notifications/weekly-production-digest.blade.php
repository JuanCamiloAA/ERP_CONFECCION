@extends('emails.layout')

@section('title', 'Resumen semanal de produccion')
@section('eyebrow', 'Produccion')
@section('preheader', 'Lo producido entre el '.$from->format('d/m').' y el '.$to->format('d/m').'.')

@section('content')
    <x-mail.badge>Resumen semanal</x-mail.badge>

    <x-mail.heading>Semana del {{ $from->format('d/m') }} al {{ $to->format('d/m') }}</x-mail.heading>

    <x-mail.text>
        Hola{{ $userName ? ' '.$userName : '' }}, esto es lo que produjo tu taller la semana pasada.
    </x-mail.text>

    <x-mail.info-card title="Totales">
        <x-mail.info-row label="Unidades" :value="number_format($units, 0, ',', '.')" />
        <x-mail.info-row label="Valor producido" :value="'$ '.number_format($value, 0, ',', '.')" />
        <x-mail.info-row label="Personas con registro" :value="(string) $activeEmployees" />
    </x-mail.info-card>

    @if (count($top) > 0)
        <x-mail.info-card title="Quien mas produjo">
            @foreach ($top as $row)
                <x-mail.info-row
                    :label="$row['name']"
                    :value="number_format($row['quantity'], 0, ',', '.').' und · $ '.number_format($row['value'], 0, ',', '.')"
                />
            @endforeach
        </x-mail.info-card>
    @else
        <x-mail.panel tone="neutral" title="Sin registros">
            La semana pasada no se registro produccion.
        </x-mail.panel>
    @endif

    <x-mail.button :url="$url" variant="solid">Ver produccion</x-mail.button>

    <x-mail.text muted space="0">
        Recibes este aviso porque tienes activado el resumen semanal de produccion.
        Puedes apagarlo en Mi perfil, en Preferencias de notificacion.
    </x-mail.text>
@endsection
