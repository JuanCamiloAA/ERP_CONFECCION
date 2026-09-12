@extends('emails.layout')

@section('title', 'Solicitud pendiente')
@section('eyebrow', 'Aprobaciones')
@section('preheader', $employeeName.' radico una solicitud que espera tu revision.')

@section('content')
    <x-mail.badge>Pendiente de aprobacion</x-mail.badge>

    <x-mail.heading>{{ $employeeName }} envio una solicitud</x-mail.heading>

    <x-mail.text>
        Hola{{ $userName ? ' '.$userName : '' }}, hay una solicitud esperando revision en la
        ficha de {{ $employeeName }}. Nada cambia hasta que la apruebes o la rechaces.
    </x-mail.text>

    <x-mail.info-card title="Detalles">
        <x-mail.info-row label="Tipo" :value="$typeLabel" />
        <x-mail.info-row label="Empleado" :value="$employeeName" />
        <x-mail.info-row label="Radicada" :value="$createdAt?->format('d/m/Y H:i') ?? '—'" />
    </x-mail.info-card>

    <x-mail.button :url="$url" variant="solid">Revisar la solicitud</x-mail.button>

    <x-mail.panel tone="neutral" title="Por seguridad">
        El detalle del monto y de los datos bancarios no viaja en este correo: se consulta en
        la ficha, donde se comprueba tu permiso.
    </x-mail.panel>

    <x-mail.text muted space="0">
        Recibes este aviso porque tienes activada la notificacion de solicitudes pendientes.
        Puedes apagarla en Mi perfil, en Preferencias de notificacion.
    </x-mail.text>
@endsection
