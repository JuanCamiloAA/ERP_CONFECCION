@extends('emails.layout')

@section('title', 'Solicitud de plan')
@section('eyebrow', 'Landing')
@section('preheader', $payload['admin_full_name'].' pide informacion'.($plan ? ' del plan '.$plan->name : '').'.')

@section('content')
    <x-mail.badge>Nueva solicitud</x-mail.badge>

    <x-mail.heading>Solicitud de plan &mdash; {{ $payload['company_name'] }}</x-mail.heading>

    <x-mail.text muted space="22px">
        Llego desde el formulario de la landing el {{ now()->format('d/m/Y') }} a las {{ now()->format('H:i') }}.
    </x-mail.text>

    <x-mail.info-card title="Plan de interes">
        @if($plan)
            <x-mail.info-row label="Plan" :value="$plan->name" />
            <x-mail.info-row label="Identificador" :value="'#'.$plan->id" />
            @if($plan->price_monthly !== null)
                <x-mail.info-row label="Precio mensual" :value="'$ '.number_format((float) $plan->price_monthly, 0, ',', '.')" />
            @endif
        @else
            <x-mail.info-row label="Plan" value="No indicado (consulta general)" />
        @endif
    </x-mail.info-card>

    <x-mail.info-card title="Empresa">
        <x-mail.info-row label="Nombre" :value="$payload['company_name']" />
        <x-mail.info-row label="NIT / documento" :value="$payload['company_tax_id'] ?? null" />
        <x-mail.info-row label="Telefono" :value="$payload['company_phone'] ?? null" type="phone" />
        <x-mail.info-row label="Correo" :value="$payload['company_email'] ?? null" type="email" />
    </x-mail.info-card>

    <x-mail.info-card title="Administrador">
        <x-mail.info-row label="Nombre" :value="$payload['admin_full_name']" />
        <x-mail.info-row label="Correo" :value="$payload['admin_email']" type="email" />
        <x-mail.info-row label="Telefono" :value="$payload['admin_phone'] ?? null" type="phone" />
    </x-mail.info-card>

    @if(! empty($payload['message']))
        <x-mail.panel title="Mensaje" pre>{{ $payload['message'] }}</x-mail.panel>
    @endif

    {{-- La solicitud no se guarda en base de datos: no hay pantalla que abrir.
         El CTA hace lo unico accionable, que es responderle al solicitante. --}}
    <x-mail.button :url="'mailto:'.$payload['admin_email']">
        Responder a {{ $payload['admin_full_name'] }}
    </x-mail.button>
@endsection
