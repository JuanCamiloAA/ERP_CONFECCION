{{--
  Bloque citado con barra de acento a la izquierda: mensajes escritos por el
  usuario, avisos, codigos. <x-mail.panel title="Mensaje">{{ $texto }}</x-mail.panel>

    pre:  respeta los saltos de linea del texto original.
    tone: accent (por defecto) | warning | danger
--}}
@props(['title' => null, 'pre' => false, 'tone' => 'accent'])
@php
    $t = config('branding.mail.palette');
    $bar = match ($tone) {
        'warning' => $t['warning'],
        'danger' => $t['danger'],
        default => $t['accent'],
    };
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:16px;background-color:{{ $t['surface'] }};border-left:3px solid {{ $bar }};border-radius:0 10px 10px 0;" bgcolor="{{ $t['surface'] }}">
    <tr>
        <td style="padding:16px 20px;">
            @if($title)
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                    <tr>
                        <td style="padding-bottom:8px;font-family:{{ $t['font'] }};font-size:11px;font-weight:700;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:{{ $t['muted'] }};mso-line-height-rule:exactly;">{{ $title }}</td>
                    </tr>
                </table>
            @endif
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                    <td style="font-family:{{ $t['font'] }};font-size:14px;line-height:22px;color:{{ $t['text'] }};{{ $pre ? 'white-space:pre-wrap;' : '' }}mso-line-height-rule:exactly;">{{ $slot }}</td>
                </tr>
            </table>
        </td>
    </tr>
</table>
