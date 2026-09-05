{{--
  Fila etiqueta/valor dentro de <x-mail.info-card>. Es un <tr>: no usarla suelta.

    type: text (por defecto) | email | phone | url  -> convierte el valor en enlace.

  Si el valor viene vacio la fila no se dibuja, asi ninguna vista necesita @if.
  El separador va arriba y no abajo justamente por eso: con filas opcionales,
  un border-bottom deja una linea colgando cuando el ultimo campo viene vacio.
--}}
@props(['label', 'value' => null, 'type' => 'text'])
@php
    $t = config('branding.mail.palette');
    $text = trim((string) ($value ?? $slot));
    $href = match ($type) {
        'email' => 'mailto:'.$text,
        'phone' => 'tel:'.preg_replace('/[^0-9+]/', '', $text),
        'url' => $text,
        default => null,
    };
    $cell = 'border-top:1px solid '.$t['surface_border'].';font-family:'.$t['font'].';mso-line-height-rule:exactly;';
@endphp
@if($text !== '')
    <tr>
        <td class="sm-stack" width="150" valign="top" style="width:150px;padding:9px 12px 9px 0;{{ $cell }}font-size:13px;line-height:20px;color:{{ $t['muted'] }};">{{ $label }}</td>
        <td class="sm-stack-gap" valign="top" style="padding:9px 0;{{ $cell }}font-size:14px;font-weight:500;line-height:20px;color:{{ $t['text'] }};word-break:break-word;">
            @if($href)
                <a href="{{ $href }}" style="color:{{ $t['accent_soft'] }};text-decoration:none;">{{ $text }}</a>
            @else
                {{ $text }}
            @endif
        </td>
    </tr>
@endif
