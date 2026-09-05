{{-- Separador horizontal entre bloques del cuerpo. <x-mail.divider /> --}}
@props(['space' => '20px'])
@php
    $t = config('branding.mail.palette');
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
        <td height="1" style="padding:{{ $space }} 0;font-size:0;line-height:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                    <td height="1" bgcolor="{{ $t['card_border'] }}" style="height:1px;background-color:{{ $t['card_border'] }};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
            </table>
        </td>
    </tr>
</table>
