{{--
  Tarjeta de datos con titulo y filas etiqueta/valor:

      <x-mail.info-card title="Empresa">
          <x-mail.info-row label="Nombre" :value="$payload['company_name']" />
          <x-mail.info-row label="Correo" :value="$email" type="email" last />
      </x-mail.info-card>

  El slot solo debe contener <x-mail.info-row>: son <tr> de la tabla interna.
--}}
@props(['title' => null])
@php
    $t = config('branding.mail.palette');
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:16px;background-color:{{ $t['surface'] }};border:1px solid {{ $t['surface_border'] }};border-radius:10px;" bgcolor="{{ $t['surface'] }}">
    <tr>
        <td style="padding:18px 20px;">
            @if($title)
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                    <tr>
                        <td style="padding-bottom:12px;font-family:{{ $t['font'] }};font-size:11px;font-weight:700;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:{{ $t['muted'] }};mso-line-height-rule:exactly;">{{ $title }}</td>
                    </tr>
                </table>
            @endif
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                {{ $slot }}
            </table>
        </td>
    </tr>
</table>
