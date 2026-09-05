{{-- Titulo de seccion del comprobante: rotulo, filete y meta a la derecha. --}}
@props(['title', 'meta' => null])
<table style="margin-top:11px;margin-bottom:3px;">
    <tr>
        <td class="sec-t" width="1%" style="padding-right:7px;">{{ $title }}</td>
        <td class="sec-line"></td>
        @if($meta)
            <td class="sec-m" width="1%" style="padding-left:7px;">{{ $meta }}</td>
        @endif
    </tr>
</table>
