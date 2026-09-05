{{--
  Boton de accion. <x-mail.button :url="$url">Ver solicitud en el panel</x-mail.button>

    variant: solid (relleno de acento) | outline (borde de acento, por defecto)
    align:   left (por defecto) | center

  Es un <a> con padding, nunca un <button>: Outlook no dibuja los botones de
  formulario. La celda VML del bloque mso le devuelve el relleno en Outlook,
  que ignora el padding de los enlaces.
--}}
@props(['url', 'variant' => 'outline', 'align' => 'left'])
@php
    $t = config('branding.mail.palette');
    $solid = $variant === 'solid';
    $bg = $solid ? $t['accent'] : $t['card'];
    $fg = $solid ? '#14121f' : $t['accent_soft'];
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:8px;">
    <tr>
        <td align="{{ $align }}" style="padding:6px 0 14px 0;">
            {{-- sm-full: en movil la tabla ocupa el ancho y el <a> (sm-btn) la llena,
                 para que el area tocable sea toda la fila y no solo el texto. --}}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="sm-full" style="{{ $align === 'center' ? 'margin:0 auto;' : '' }}">
                <tr>
                    <td bgcolor="{{ $bg }}" align="center" style="background-color:{{ $bg }};border:1px solid {{ $t['accent'] }};border-radius:8px;mso-padding-alt:14px 26px;">
                        <a class="sm-btn" href="{{ $url }}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:{{ $t['font'] }};font-size:14px;font-weight:{{ $solid ? '700' : '600' }};line-height:18px;color:{{ $fg }};text-decoration:none;letter-spacing:-0.01em;mso-line-height-rule:exactly;">{{ $slot }}</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
