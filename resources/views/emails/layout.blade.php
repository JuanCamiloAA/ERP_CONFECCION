{{--
  Layout base de TODOS los correos de la aplicacion.

  Uso desde cualquier vista de correo:

      @extends('emails.layout')
      @section('preheader', 'Texto de vista previa en la bandeja')
      @section('content')
          <x-mail.badge>Nueva solicitud</x-mail.badge>
          <x-mail.heading>Titulo</x-mail.heading>
      @endsection

  Reglas que no se pueden romper (compatibilidad Outlook / Gmail / Apple Mail):
    - Estructura SOLO con <table role="presentation">. Nada de flex ni grid.
    - Estilos 100% inline. El bloque <style> es un extra progresivo para movil:
      cada regla de ahi ya tiene su equivalente inline como respaldo.
    - Outlook de escritorio ignora border-radius y box-shadow: degrada a esquinas
      cuadradas, y eso es aceptable.
    - El icono de marca es un cuadro solido, no una imagen: las imagenes remotas
      llegan bloqueadas en la primera apertura y el encabezado quedaria vacio.
--}}
@php
    $t = config('branding.mail.palette');
    $font = $t['font'];
    $brand = (string) config('branding.mail.brand');
    $monogram = (string) (config('branding.mail.monogram') ?: mb_substr(ltrim($brand), 0, 1));
    $social = config('branding.mail.social', []);
    $supportEmail = config('branding.mail.support_email');
@endphp
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>@yield('title', $brand)</title>
    <!--[if mso]>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
    <style>table,td,div,p,a{font-family:Helvetica,Arial,sans-serif !important;}</style>
    <![endif]-->
    <style>
        html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
        body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        a { text-decoration: none; }

        /* Gmail y Apple Mail autolinkan telefonos y direcciones con su propio azul. */
        a[x-apple-data-detectors], .unstyle-auto-detected-links a, .aBn {
            color: inherit !important; text-decoration: none !important; font-size: inherit !important;
            font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important;
            border-bottom: 0 !important;
        }

        /* Movil: cada regla tiene su respaldo inline, esto solo aprieta el espaciado. */
        @media only screen and (max-width: 620px) {
            .sm-full { width: 100% !important; max-width: 100% !important; }
            .sm-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .sm-pad-y { padding-top: 24px !important; padding-bottom: 24px !important; }
            /* Etiqueta y valor pasan de dos columnas a dos lineas. El valor pierde
               el separador: si no, la linea divisoria se cuela entre ambos. */
            .sm-stack { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 0 !important; }
            .sm-stack-gap { display: block !important; width: 100% !important; padding-top: 0 !important; border-top: 0 !important; }
            .sm-title { font-size: 22px !important; line-height: 30px !important; }
            .sm-btn { display: block !important; width: 100% !important; text-align: center !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:{{ $t['page'] }};color:{{ $t['text'] }};font-family:{{ $font }};" bgcolor="{{ $t['page'] }}">

    {{-- Vista previa de la bandeja. El relleno invisible evita que el cliente
         complete la linea con el primer texto visible del cuerpo. --}}
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{{ $t['page'] }};opacity:0;">
        @yield('preheader', $brand)
        &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:{{ $t['page'] }};" bgcolor="{{ $t['page'] }}">
        <tr>
            <td align="center" class="sm-pad-y" style="padding:32px 12px;">

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="sm-full" style="width:600px;max-width:100%;background-color:{{ $t['card'] }};border:1px solid {{ $t['card_border'] }};border-radius:14px;" bgcolor="{{ $t['card'] }}">

                    {{-- Encabezado: identico en todos los correos --}}
                    <tr>
                        <td class="sm-pad" style="padding:26px 32px 22px 32px;border-bottom:1px solid {{ $t['card_border'] }};">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                                <tr>
                                    <td width="36" valign="middle" style="width:36px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="36" style="width:36px;">
                                            <tr>
                                                <td align="center" valign="middle" height="36" bgcolor="{{ $t['accent_bg'] }}" style="width:36px;height:36px;background-color:{{ $t['accent_bg'] }};border-radius:10px;font-family:{{ $font }};font-size:16px;font-weight:700;line-height:36px;color:{{ $t['accent_soft'] }};text-align:center;mso-line-height-rule:exactly;">{{ mb_strtoupper($monogram) }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td valign="middle" style="padding-left:12px;font-family:{{ $font }};font-size:16px;font-weight:600;line-height:24px;color:{{ $t['text'] }};letter-spacing:-0.01em;">{{ $brand }}</td>
                                    @hasSection('eyebrow')
                                        <td align="right" valign="middle" style="font-family:{{ $font }};font-size:12px;font-weight:500;line-height:20px;color:{{ $t['muted'] }};">@yield('eyebrow')</td>
                                    @endif
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Cuerpo: lo unico que cambia entre correos --}}
                    <tr>
                        <td class="sm-pad sm-pad-y" style="padding:32px;font-family:{{ $font }};font-size:15px;line-height:24px;color:{{ $t['text'] }};">
                            @yield('content')
                        </td>
                    </tr>

                    {{-- Pie: identico en todos los correos --}}
                    <tr>
                        <td class="sm-pad" style="padding:24px 32px 28px 32px;border-top:1px solid {{ $t['card_border'] }};">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                                @if(! empty($social))
                                    <tr>
                                        <td style="padding-bottom:18px;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    @foreach($social as $network)
                                                        <td width="32" style="width:32px;padding-right:8px;">
                                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="32" style="width:32px;">
                                                                <tr>
                                                                    <td align="center" valign="middle" height="32" style="width:32px;height:32px;border:1px solid {{ $t['hairline'] }};border-radius:8px;">
                                                                        <a href="{{ $network['url'] }}" title="{{ $network['title'] }}" style="display:block;width:32px;font-family:{{ $font }};font-size:11px;font-weight:600;line-height:30px;color:{{ $t['subtle'] }};text-decoration:none;text-align:center;">{{ $network['label'] }}</a>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    @endforeach
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                @endif
                                <tr>
                                    <td class="unstyle-auto-detected-links" style="font-family:{{ $font }};font-size:13px;font-weight:500;line-height:20px;color:{{ $t['subtle'] }};">
                                        {{ $brand }} &middot; {{ config('branding.mail.address') }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top:6px;font-family:{{ $font }};font-size:12px;line-height:18px;color:{{ $t['muted'] }};">
                                        {{ config('branding.mail.legal') }}
                                        @if($supportEmail)
                                            <br>Escribenos a <a href="mailto:{{ $supportEmail }}" style="color:{{ $t['accent_soft'] }};text-decoration:none;">{{ $supportEmail }}</a>.
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
