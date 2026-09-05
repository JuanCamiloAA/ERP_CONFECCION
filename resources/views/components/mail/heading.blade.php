{{--
  Titulo del correo. <x-mail.heading>Solicitud de plan</x-mail.heading>
  size: lg (titular, por defecto) | md (subtitulo de seccion).
--}}
@props(['size' => 'lg'])
@php
    $t = config('branding.mail.palette');
    $isLarge = $size === 'lg';
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
        <td class="{{ $isLarge ? 'sm-title' : '' }}" style="padding-bottom:{{ $isLarge ? '10px' : '8px' }};font-family:{{ $t['font'] }};font-size:{{ $isLarge ? '25px' : '17px' }};font-weight:{{ $isLarge ? '700' : '600' }};line-height:{{ $isLarge ? '33px' : '24px' }};letter-spacing:-0.02em;color:{{ $t['text'] }};mso-line-height-rule:exactly;">{{ $slot }}</td>
    </tr>
</table>
