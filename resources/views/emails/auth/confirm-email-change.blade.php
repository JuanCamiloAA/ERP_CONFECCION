@extends('emails.layout')

@section('title', 'Confirma tu correo nuevo')
@section('eyebrow', 'Seguridad')
@section('preheader', 'Enlace para confirmar tu correo de acceso. Caduca en '.$expiresInMinutes.' minutos.')

@section('content')
    <x-mail.badge tone="neutral">Seguridad de la cuenta</x-mail.badge>

    <x-mail.heading>Confirma tu correo nuevo</x-mail.heading>

    <x-mail.text>
        Hola{{ $userName ? ' '.$userName : '' }}, pediste usar
        <strong style="color:{{ config('branding.mail.palette.text') }};">{{ $newEmail }}</strong>
        para iniciar sesion. Confirma que esta bandeja es tuya con el boton de abajo.
    </x-mail.text>

    <x-mail.button :url="$url" variant="solid">Confirmar este correo</x-mail.button>

    <x-mail.info-card title="Detalles">
        <x-mail.info-row label="Correo nuevo" :value="$newEmail" />
        <x-mail.info-row label="Caduca en" :value="$expiresInMinutes.' minutos'" />
    </x-mail.info-card>

    <x-mail.panel tone="warning" title="Hasta que confirmes">
        Tu correo de acceso actual sigue funcionando igual. Nada cambia mientras no se use este enlace.
    </x-mail.panel>

    <x-mail.text muted space="0">
        Si no pediste este cambio, ignora el correo y cambia tu contrasena por precaucion.
    </x-mail.text>
@endsection
