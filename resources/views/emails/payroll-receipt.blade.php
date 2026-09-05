@extends('emails.layout')

@section('title', 'Comprobante de nómina')
@section('eyebrow', 'Nómina')
@section('preheader', 'Neto a pagar '.\App\Support\ReceiptFormat::currency($receipt['net']).' · periodo '.$receipt['payroll']['period_text'])

@section('content')
    @php($f = \App\Support\ReceiptFormat::class)

    <x-mail.badge tone="success">Nómina pagada</x-mail.badge>

    <x-mail.heading>Tu comprobante de {{ $receipt['payroll']['name'] }}</x-mail.heading>

    <x-mail.text muted space="22px">
        Hola {{ $receipt['employee']['name'] }}, adjuntamos tu comprobante de nómina del periodo
        {{ $receipt['payroll']['period_text'] }} en PDF. Abajo tienes el resumen.
    </x-mail.text>

    {{-- El neto es lo que la persona busca al abrir el correo: va primero y sin competencia. --}}
    <x-mail.panel title="Neto a pagar">
        <span style="font-size:24px;font-weight:700;line-height:32px;color:{{ config('branding.mail.palette.text') }};">{{ $f::currency($receipt['net']) }}</span>
    </x-mail.panel>

    <x-mail.info-card title="Periodo">
        <x-mail.info-row label="Nómina" :value="$receipt['payroll']['name']" />
        <x-mail.info-row label="Desde" :value="$receipt['payroll']['period_start']" />
        <x-mail.info-row label="Hasta" :value="$receipt['payroll']['period_end']" />
        <x-mail.info-row label="Modalidad" :value="$receipt['employee']['mode_label']" />
        <x-mail.info-row label="Documento" :value="$receipt['employee']['document_type'].' '.$receipt['employee']['document_number']" />
    </x-mail.info-card>

    <x-mail.info-card title="Devengos">
        @if($receipt['stats']['is_operations'])
            <x-mail.info-row label="Producido" :value="$f::currency($receipt['earnings']['production_total'])" />
            @if($receipt['totals']['prod_units'] > 0)
                <x-mail.info-row label="Unidades" :value="$f::number($receipt['totals']['prod_units'])" />
            @endif
        @endif
        @if($receipt['earnings']['has_daily'])
            <x-mail.info-row label="Jornada" :value="$f::currency($receipt['earnings']['daily'])" />
        @endif
        @if($receipt['earnings']['has_legal'])
            <x-mail.info-row label="Jornada legal y recargos" :value="$f::currency($receipt['earnings']['legal'])" />
        @endif
        @if($receipt['stats']['sessions_count'] > 0)
            <x-mail.info-row label="Días trabajados" :value="$receipt['stats']['sessions_count'].' · '.$receipt['stats']['hours'].' h'" />
        @endif
        <x-mail.info-row label="Conceptos manuales" :value="$f::currency($receipt['earnings']['adjustments'])" />
        <x-mail.info-row label="Total bruto" :value="$f::currency($receipt['earnings']['gross'])" />
    </x-mail.info-card>

    <x-mail.info-card title="Descuentos">
        <x-mail.info-row label="Deducciones de ley" :value="'− '.$f::currency($receipt['discounts']['deductions'])" />
        <x-mail.info-row label="Anticipo aplicado" :value="'− '.$f::currency($receipt['discounts']['applied'])" />
        @if($receipt['discounts']['absence'] > 0)
            <x-mail.info-row label="Inasistencia" :value="'− '.$f::currency($receipt['discounts']['absence'])" />
        @endif
        <x-mail.info-row label="Total descuentos" :value="'− '.$f::currency($receipt['discounts']['total'])" />
    </x-mail.info-card>

    @if($receipt['carried'] > 0)
        <x-mail.panel tone="warning" title="Saldo de anticipos">
            Quedan {{ $f::currency($receipt['carried']) }} de anticipos sin cubrir; el saldo se
            traslada al siguiente periodo de liquidación.
        </x-mail.panel>
    @endif

    <x-mail.button :url="$link" variant="solid">Ver el comprobante en línea</x-mail.button>

    <x-mail.text muted space="0">
        El PDF va adjunto a este correo. Si tu aplicación de correo bloquea los adjuntos, usa el
        botón: el enlace abre el mismo documento y es personal, no lo compartas.
    </x-mail.text>
@endsection
