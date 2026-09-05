{{--
  Parrafo. <x-mail.text muted>Texto secundario</x-mail.text>
  pre: respeta saltos de linea (para mensajes escritos por el usuario).
--}}
@props(['muted' => false, 'pre' => false, 'space' => '16px'])
@php
    $t = config('branding.mail.palette');
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
        <td style="padding-bottom:{{ $space }};font-family:{{ $t['font'] }};font-size:{{ $muted ? '14px' : '15px' }};line-height:{{ $muted ? '22px' : '24px' }};color:{{ $muted ? $t['muted'] : $t['text'] }};{{ $pre ? 'white-space:pre-wrap;' : '' }}mso-line-height-rule:exactly;">{{ $slot }}</td>
    </tr>
</table>
