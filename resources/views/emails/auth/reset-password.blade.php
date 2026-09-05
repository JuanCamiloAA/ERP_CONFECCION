@extends('emails.layout')

@section('title', 'Recupera tu contrasena')
@section('eyebrow', 'Seguridad')
@section('preheader', 'Enlace para crear una contrasena nueva. Caduca en '.$expiresInMinutes.' minutos.')

@section('content')
    <x-mail.badge tone="neutral">Seguridad de la cuenta</x-mail.badge>

    <x-mail.heading>Recupera tu contrasena</x-mail.heading>

    <x-mail.text>
        Hola{{ $user->name ? ' '.$user->name : '' }}, recibimos una solicitud para restablecer la
        contrasena de <strong style="color:{{ config('branding.mail.palette.text') }};">{{ $user->email }}</strong>.
        Usa el boton para crear una nueva.
    </x-mail.text>

    <x-mail.button :url="$url" variant="solid">Crear contrasena nueva</x-mail.button>

    <x-mail.info-card title="Detalles">
        <x-mail.info-row label="Cuenta" :value="$user->email" />
        <x-mail.info-row label="Caduca en" :value="$expiresInMinutes.' minutos'" />
    </x-mail.info-card>

    <x-mail.panel tone="warning" title="Si no fuiste tu">
        Ignora este correo: tu contrasena no cambia mientras no se use el enlace.
    </x-mail.panel>

    <x-mail.text muted space="0">
        Si el boton no funciona, copia y pega esta direccion en el navegador:<br>
        <a href="{{ $url }}" style="color:{{ config('branding.mail.palette.accent_soft') }};text-decoration:none;word-break:break-all;">{{ $url }}</a>
    </x-mail.text>
@endsection
