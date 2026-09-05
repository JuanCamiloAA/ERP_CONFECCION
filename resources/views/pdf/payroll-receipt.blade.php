{{--
  Comprobante individual de nomina en PDF (dompdf).

  Es la version imprimible en servidor de `resources/js/Pages/Payrolls/Receipt.tsx`, que
  solo existe en el navegador. Mantiene su retícula (carta, 12 mm, tinta #111827, acento
  #c2410c) para que el PDF adjunto y el que el empleado imprime desde la pantalla se vean
  como el mismo documento.

  dompdf no entiende flex ni grid: todo lo que en la pantalla es `display:flex` aqui es una
  tabla de una fila. Tampoco hereda variables CSS, asi que los colores van literales.
--}}
@php($f = \App\Support\ReceiptFormat::class)
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Comprobante {{ $employee['name'] }}</title>
    <style>
        @page { size: letter; margin: 12mm; }

        body {
            margin: 0;
            font-family: Helvetica, Arial, sans-serif;
            font-size: 8pt;
            color: #111827;
            background: #fff;
        }
        table { width: 100%; border-collapse: collapse; }
        td, th { vertical-align: top; }
        .r { text-align: right; }
        .c { text-align: center; }
        .dim { color: #6b7280; }
        .faint { color: #9ca3af; }
        .hi { color: #c2410c; }
        .link { color: #1d4ed8; }
        .b { font-weight: bold; }

        .logo {
            width: 34px; height: 34px; background: #111827; color: #fff;
            border-radius: 17px; text-align: center; font-size: 13pt; font-weight: bold;
        }
        .company { font-size: 12pt; font-weight: bold; }
        .meta { font-size: 6.5pt; color: #6b7280; }
        .kicker { font-size: 6pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.1px; color: #c2410c; }
        .title { font-size: 13pt; font-weight: bold; }
        .accent { font-size: 6.5pt; color: #c2410c; }

        .rule { border-top: 2px solid #111827; height: 1px; font-size: 0; line-height: 0; }

        .label { font-size: 5.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; }
        .emp-name { font-size: 14pt; font-weight: bold; }
        .emp-meta { font-size: 6.5pt; }

        .stats { border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb; }
        .stat { padding: 5px 9px; border-left: 1px solid #e5e7eb; }
        .stat-first { border-left: 0; }
        .stat-v { font-size: 11pt; font-weight: bold; }
        .stat-s { font-size: 5.5pt; color: #9ca3af; }

        .sec-t { font-size: 6.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; color: #111827; white-space: nowrap; }
        .sec-line { border-bottom: 1px solid #e5e7eb; }
        .sec-m { font-size: 6.5pt; color: #9ca3af; white-space: nowrap; text-align: right; }

        .grid th {
            font-size: 5.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.9px;
            color: #9ca3af; text-align: left; padding: 4px 5px; border-bottom: 1px solid #e5e7eb;
        }
        .grid td { padding: 3px 5px; border-bottom: 1px solid #f3f4f6; font-size: 7pt; }
        .grid tfoot td { font-weight: bold; border-top: 1px solid #111827; border-bottom: 0; padding-top: 5px; }

        .liq-h { font-size: 5.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; padding-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
        .liq td { font-size: 7pt; padding: 2.5px 0; border-bottom: 1px solid #f3f4f6; }
        .liq tr.tot td { font-size: 7.5pt; font-weight: bold; padding-top: 4px; border-top: 1px solid #111827; border-bottom: 0; }

        .net { background: #111827; color: #fff; border-radius: 4px; }
        .net td { padding: 8px 12px; }
        .net-l { font-size: 6.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; }
        .net-s { font-size: 5.5pt; color: #9ca3af; }
        .net-v { font-size: 16pt; font-weight: bold; text-align: right; }

        .note { border-left: 3px solid #c2410c; background: #fff7ed; font-size: 6.5pt; }
        .note td { padding: 5px 8px; }

        .sign { border-top: 1px solid #111827; padding-top: 4px; text-align: center; }
        .sign-n { font-size: 7pt; font-weight: bold; }
        .sign-s { font-size: 5.5pt; color: #9ca3af; }

        .foot { border-top: 1px solid #e5e7eb; padding-top: 4px; font-size: 5.5pt; color: #9ca3af; }
        .empty { font-size: 7pt; color: #6b7280; padding: 6px 0; }
        .sp { height: 10px; font-size: 0; line-height: 0; }
        .sp-sm { height: 6px; font-size: 0; line-height: 0; }
    </style>
</head>
<body>

{{-- ------------------------------------------------------------------ encabezado --}}
<table>
    <tr>
        <td width="55%">
            <table>
                <tr>
                    <td width="34" style="width:34px;">
                        <table>
                            <tr><td class="logo" height="34">{{ $company['initial'] }}</td></tr>
                        </table>
                    </td>
                    <td style="padding-left:10px;">
                        <div class="company">{{ $company['name'] }}</div>
                        @if($company['nit'])<div class="meta">NIT {{ $company['nit'] }}</div>@endif
                        @if($company['address'])<div class="meta">{{ $company['address'] }}</div>@endif
                        @if($company['phone'])<div class="meta">Tel: {{ $company['phone'] }}</div>@endif
                    </td>
                </tr>
            </table>
        </td>
        <td width="45%" class="r">
            <div class="kicker">Comprobante de pago</div>
            <div class="title">Liquidación de Nómina</div>
            <div class="accent">{{ $payroll['name'] }}</div>
            <div class="meta">Periodo {{ $payroll['period_text'] }}</div>
        </td>
    </tr>
</table>

<div class="sp-sm"></div>
<div class="rule"></div>
<div class="sp-sm"></div>

{{-- -------------------------------------------------------------------- empleado --}}
<table>
    <tr>
        <td width="58%">
            <div class="label">Empleado</div>
            <div class="emp-name">{{ $employee['name'] }}</div>
            <div class="emp-meta">
                <span class="link">{{ $employee['document_type'] }} {{ $employee['document_number'] }}</span>
                &nbsp;&nbsp;<span class="hi">Modalidad {{ $employee['mode_label'] }}</span>
                @if($employee['bank_name'])
                    <br><span class="dim">{{ $employee['bank_name'] }}@if($employee['bank_account']) · {{ $employee['bank_account'] }}@endif</span>
                @endif
            </div>
        </td>
        <td width="42%" class="r">
            <table class="stats" style="width:auto;" align="right">
                <tr>
                    @php($firstStat = true)
                    @if($stats['is_operations'] && count($productions) > 0)
                        <td class="stat stat-first">
                            <div class="label">Operaciones</div>
                            <div class="stat-v">{{ $f::number($stats['units']) }}</div>
                            <div class="stat-s">unidades</div>
                        </td>
                        @php($firstStat = false)
                    @endif
                    @if($stats['sessions_count'] > 0)
                        <td class="stat {{ $firstStat ? 'stat-first' : '' }}">
                            <div class="label">Jornadas</div>
                            <div class="stat-v">{{ $stats['sessions_count'] }}</div>
                            <div class="stat-s">{{ $f::number($stats['minutes']) }} min · {{ $stats['hours'] }} h</div>
                        </td>
                        @php($firstStat = false)
                    @endif
                    <td class="stat {{ $firstStat ? 'stat-first' : '' }}">
                        <div class="label">Bruto</div>
                        <div class="stat-v">{{ $f::currency($stats['gross']) }}</div>
                        <div class="stat-s">devengado</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>

{{-- ------------------------------------------------------- detalle del devengado --}}
@if($stats['is_operations'])
    <x-pdf.section title="Detalle de operaciones"
                   :meta="count($productions).' '.(count($productions) === 1 ? 'registro' : 'registros')" />
    @if(count($productions) === 0)
        <div class="empty">Sin producción liquidable en el periodo.</div>
    @else
        <table class="grid">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Operación</th>
                    <th class="r">Cant.</th>
                    <th class="r">Valor</th>
                </tr>
            </thead>
            <tbody>
                @foreach($productions as $production)
                    <tr>
                        <td>{{ $production['date'] }}</td>
                        <td>
                            @if($production['reference_code'])
                                <span class="link">{{ $production['reference_code'] }}</span> {{ $production['reference_name'] }}
                            @else
                                —
                            @endif
                        </td>
                        <td class="dim">{{ $production['operation'] }}</td>
                        <td class="r">{{ $f::number($production['quantity']) }}</td>
                        <td class="r">{{ $f::currency($production['value']) }}</td>
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="r">Total operaciones</td>
                    <td class="r">{{ $f::number($totals['prod_units']) }}</td>
                    <td class="r">{{ $f::currency($totals['prod_value']) }}</td>
                </tr>
            </tfoot>
        </table>
    @endif
@else
    <x-pdf.section title="Jornadas registradas"
                   :meta="count($sessions).' '.(count($sessions) === 1 ? 'día' : 'días')" />
    @if(count($sessions) === 0)
        <div class="empty">Sin jornadas registradas en el periodo.</div>
    @else
        <table class="grid">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th class="r">Minutos</th>
                    <th class="r">Horas</th>
                    <th class="r">Valor del día</th>
                </tr>
            </thead>
            <tbody>
                @foreach($sessions as $session)
                    <tr>
                        <td @class(['hi' => $session['is_special']])>
                            {{ $session['date'] }}@if($session['is_special']) · dom/festivo @endif
                        </td>
                        <td class="dim">{{ $session['clock_in'] }}</td>
                        <td class="dim">{{ $session['clock_out'] }}</td>
                        <td class="r">{{ $f::number($session['minutes']) }}</td>
                        <td class="r">{{ $session['hours'] }}</td>
                        <td class="r">{{ $session['amount'] === null ? '—' : $f::currency($session['amount']) }}</td>
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="r">Total jornada</td>
                    <td class="r">{{ $f::number($totals['session_minutes']) }}</td>
                    <td class="r">{{ $f::hours($totals['session_minutes']) }}</td>
                    <td class="r">{{ $f::currency($totals['session_amount']) }}</td>
                </tr>
            </tfoot>
        </table>
    @endif
@endif

{{-- ------------------------------------------------------ recargos legales --}}
@if($legal)
    <x-pdf.section title="Recargos y horas extra (ley)" />
    <table class="grid">
        <tbody>
            <tr><td>Salario base del periodo</td><td class="r">{{ $f::currency($legal['base_salary_earned']) }}</td></tr>
            <tr><td>Recargo nocturno</td><td class="r">{{ $f::currency($legal['night']) }}</td></tr>
            <tr><td>Recargo dominical / festivo</td><td class="r">{{ $f::currency($legal['sunday']) }}</td></tr>
            <tr><td>Horas extra</td><td class="r">{{ $f::currency($legal['overtime']) }}</td></tr>
        </tbody>
    </table>
@endif

{{-- ------------------------------------------------------------- liquidación --}}
<x-pdf.section title="Liquidación del periodo" />
<table>
    <tr>
        <td width="49%">
            <div class="liq-h">Devengos</div>
            <table class="liq">
                @if($stats['is_operations'])
                    <tr><td>Producido (pago por operación)</td><td class="r">{{ $f::currency($earnings['production_total']) }}</td></tr>
                @endif
                @if($earnings['has_daily'])
                    <tr><td>Jornada ({{ $stats['hours'] }} h)</td><td class="r">{{ $f::currency($earnings['daily']) }}</td></tr>
                @endif
                @if($earnings['has_legal'])
                    <tr><td>Jornada legal, recargos y extras</td><td class="r">{{ $f::currency($earnings['legal']) }}</td></tr>
                @endif
                <tr><td>Conceptos manuales</td><td class="r">{{ $f::currency($earnings['adjustments']) }}</td></tr>
                <tr class="tot"><td>Total bruto</td><td class="r">{{ $f::currency($earnings['gross']) }}</td></tr>
            </table>
        </td>
        <td width="2%"></td>
        <td width="49%">
            <div class="liq-h">Descuentos</div>
            <table class="liq">
                <tr><td>Deducciones de ley</td><td class="r">- {{ $f::currency($discounts['deductions']) }}</td></tr>
                @if($discounts['delivered'] > 0)
                    <tr><td class="dim">Anticipos entregados</td><td class="r dim">{{ $f::currency($discounts['delivered']) }}</td></tr>
                @endif
                <tr><td>Anticipo aplicado en este periodo</td><td class="r">- {{ $f::currency($discounts['applied']) }}</td></tr>
                @if($discounts['absence'] > 0)
                    <tr><td>Descuento por inasistencia</td><td class="r">- {{ $f::currency($discounts['absence']) }}</td></tr>
                @endif
                <tr class="tot"><td>Total descuentos</td><td class="r">- {{ $f::currency($discounts['total']) }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="sp"></div>

<table class="net">
    <tr>
        <td>
            <div class="net-l">Neto a pagar</div>
            <div class="net-s">Periodo {{ $payroll['period_text'] }}</div>
        </td>
        <td class="net-v">{{ $f::currency($net) }}</td>
    </tr>
</table>

@if($carried > 0)
    <div class="sp-sm"></div>
    <table class="note">
        <tr><td><b class="hi">Saldo de anticipos</b> &nbsp; Quedan {{ $f::currency($carried) }} de anticipos sin cubrir; el saldo se traslada al siguiente periodo de liquidación.</td></tr>
    </table>
@endif

@if($over_discount)
    <div class="sp-sm"></div>
    <table class="note">
        <tr><td><b class="hi">Descuentos mayores al devengado</b> &nbsp; Los descuentos ({{ $f::currency($discounts['total']) }}) superan lo devengado ({{ $f::currency($earnings['gross']) }}). El neto se ajusta a {{ $f::currency(0) }} y la diferencia de {{ $f::currency($over_discount_diff) }} no alcanza a descontarse en este periodo.</td></tr>
    </table>
@endif

<div class="sp"></div>
<div class="sp"></div>

<table>
    <tr>
        <td width="45%"><div class="sign">
            <div class="sign-n">Firma responsable</div>
            <div class="sign-s">{{ $company['name'] }}</div>
        </div></td>
        <td width="10%"></td>
        <td width="45%"><div class="sign">
            <div class="sign-n">{{ $employee['name'] }}</div>
            <div class="sign-s">Documento {{ $employee['document_number'] }}</div>
        </div></td>
    </tr>
</table>

<div class="sp"></div>

<table class="foot">
    <tr>
        <td>{{ $company['name'] }}@if($company['nit']) · NIT {{ $company['nit'] }}@endif · Comprobante de nómina</td>
        <td class="r">Periodo {{ $payroll['period_text'] }}</td>
    </tr>
</table>

</body>
</html>
