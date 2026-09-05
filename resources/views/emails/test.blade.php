@extends('emails.layout')

@section('title', 'Prueba de correo')
@section('eyebrow', 'Diagnostico')
@section('preheader', 'Si lees esto, el envio de correo funciona.')

@section('content')
    <x-mail.badge tone="success">Envio correcto</x-mail.badge>

    <x-mail.heading>La configuracion de correo funciona</x-mail.heading>

    <x-mail.text muted space="22px">
        Este mensaje usa la misma plantilla que el resto de los correos de la
        aplicacion, asi que lo que ves aqui es lo que veran tus usuarios.
    </x-mail.text>

    <x-mail.info-card title="Datos del envio">
        <x-mail.info-row label="Transporte" :value="$transport" />
        <x-mail.info-row label="Remitente" :value="config('mail.from.address')" type="email" />
        <x-mail.info-row label="Aplicacion" :value="config('app.name')" />
        <x-mail.info-row label="Enviado el" :value="$sentAt->format('d/m/Y H:i:s')" />
    </x-mail.info-card>

    <x-mail.panel title="Que revisar">
        Que el encabezado, las tarjetas y el boton se vean alineados y sin bordes
        rotos. En Outlook de escritorio las esquinas salen cuadradas: es esperado.
    </x-mail.panel>

    <x-mail.button :url="config('app.url')" variant="solid">Abrir la aplicacion</x-mail.button>
@endsection
