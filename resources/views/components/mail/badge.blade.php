{{--
  Etiqueta de estado sobre el titulo: <x-mail.badge tone="success">Pago recibido</x-mail.badge>
  Tonos: accent (por defecto), success, warning, danger, neutral.
--}}
@props(['tone' => 'accent'])
@php
    $t = config('branding.mail.palette');
    $tones = [
        'accent' => [$t['accent_bg'], $t['accent_soft']],
        'success' => [$t['success_bg'], $t['success']],
        'warning' => [$t['warning_bg'], $t['warning']],
        'danger' => [$t['danger_bg'], $t['danger']],
        'neutral' => [$t['surface'], $t['subtle']],
    ];
    [$bg, $fg] = $tones[$tone] ?? $tones['accent'];
@endphp
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
    <tr>
        <td bgcolor="{{ $bg }}" style="padding:6px 12px;background-color:{{ $bg }};border-radius:8px;font-family:{{ $t['font'] }};font-size:12px;font-weight:600;line-height:16px;letter-spacing:0.02em;color:{{ $fg }};mso-line-height-rule:exactly;">{{ $slot }}</td>
    </tr>
</table>
