<?php

namespace App\Services\Productions;

use App\Models\Company;
use App\Support\Docx\DocxDocument;
use App\Support\Xlsx\XlsxCell;
use App\Support\Xlsx\XlsxStyle;
use App\Support\Xlsx\XlsxWorkbook;
use Illuminate\Support\Carbon;

/**
 * Exporta el ranking de produccion a Excel o a Word.
 *
 * Los dos archivos llevan exactamente lo mismo —encabezado con el rango y los filtros
 * aplicados, la tabla del podio y la fila de totales—, porque quien elige el formato esta
 * eligiendo con que programa lo abre, no cuanta informacion recibe. La diferencia es de
 * uso: el Excel sale con los numeros como numeros, para sumar y ordenar; el Word sale
 * paginado y con el encabezado repetido, para imprimir o pegar en un informe.
 */
class ProductionRankingExport
{
    private const SHIFT_LABEL = ['manana' => 'Mañana', 'tarde' => 'Tarde', 'noche' => 'Noche'];

    /** @var list<string> */
    private const HEADERS = [
        'Puesto', 'Empleado', 'Documento', 'Unidades', 'Puntos', 'Registros', 'Valor', 'Variación %',
    ];

    /**
     * @param  list<array<string, mixed>>  $rows  filas de ProductionController::rankingRows()
     * @param  array{start: string, end: string, only_confirmed: bool, reference_id: int|null, shift: string|null}  $filters
     * @param  array{start: string, end: string}  $previousPeriod
     * @return string bytes del .xlsx
     */
    public function xlsx(array $rows, array $filters, array $previousPeriod, ?Company $company, ?string $referenceLabel): string
    {
        $workbook = new XlsxWorkbook($this->currency($company));
        $sheet = $workbook->addSheet('Ranking');

        $sheet->widths([8, 34, 16, 12, 12, 12, 18, 14])->hideGridLines();

        $sheet->row([XlsxCell::text('Ranking de producción', XlsxStyle::TITLE)]);
        $sheet->merge(0, 0, 7, 0);

        foreach ($this->context($filters, $previousPeriod, $company, $referenceLabel) as $line) {
            $sheet->row([XlsxCell::text($line, XlsxStyle::MUTED)]);
            $sheet->merge(0, $sheet->cursor() - 1, 7, $sheet->cursor() - 1);
        }

        $sheet->blank();

        // La cabecera se congela: un ranking de cincuenta personas se lee desplazando.
        $sheet->row(array_map(fn (string $head) => XlsxCell::text($head, XlsxStyle::HEAD), self::HEADERS));
        $sheet->freezeRows($sheet->cursor());

        foreach ($rows as $row) {
            $sheet->row([
                XlsxCell::number($row['position'], XlsxStyle::INTEGER),
                XlsxCell::text($this->name($row), XlsxStyle::BOX),
                XlsxCell::text($row['employee']['document_number'] ?? null, XlsxStyle::BOX),
                XlsxCell::number($row['total_quantity'], XlsxStyle::INTEGER),
                XlsxCell::number($row['total_points'], XlsxStyle::INTEGER),
                XlsxCell::number($row['records'], XlsxStyle::INTEGER),
                XlsxCell::number($row['total_value'], XlsxStyle::MONEY),
                // Como fraccion, no como texto: asi Excel la formatea y la puede graficar.
                $row['change_percent'] === null
                    ? XlsxCell::text('nuevo', XlsxStyle::BOX)
                    : XlsxCell::number($row['change_percent'] / 100, XlsxStyle::PERCENT_ONE),
            ]);
        }

        $totals = $this->totals($rows);

        $sheet->row([
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::text('Total ('.$totals['employees'].' empleados)', XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::number($totals['quantity'], XlsxStyle::INTEGER_TOTAL),
            XlsxCell::number($totals['points'], XlsxStyle::INTEGER_TOTAL),
            XlsxCell::number($totals['records'], XlsxStyle::INTEGER_TOTAL),
            XlsxCell::number($totals['value'], XlsxStyle::MONEY_TOTAL),
            $totals['change'] === null
                ? XlsxCell::empty(XlsxStyle::BOX_TOTAL)
                : XlsxCell::number($totals['change'] / 100, XlsxStyle::PERCENT_ONE_TOTAL),
        ]);

        return $workbook->contents();
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array{start: string, end: string, only_confirmed: bool, reference_id: int|null, shift: string|null}  $filters
     * @param  array{start: string, end: string}  $previousPeriod
     * @return string bytes del .docx
     */
    public function docx(array $rows, array $filters, array $previousPeriod, ?Company $company, ?string $referenceLabel): string
    {
        $document = new DocxDocument('Ranking de producción');

        foreach ($this->context($filters, $previousPeriod, $company, $referenceLabel) as $line) {
            $document->paragraph($line, DocxDocument::MUTED);
        }

        $totals = $this->totals($rows);

        $body = [];

        foreach ($rows as $row) {
            $body[] = [
                (string) $row['position'],
                $this->name($row),
                (string) ($row['employee']['document_number'] ?? ''),
                $this->number($row['total_quantity']),
                $this->number($row['total_points']),
                $this->number($row['records']),
                $this->money($row['total_value'], $company),
                $this->percent($row['change_percent']),
            ];
        }

        $body[] = [
            '',
            'Total ('.$totals['employees'].' empleados)',
            '',
            $this->number($totals['quantity']),
            $this->number($totals['points']),
            $this->number($totals['records']),
            $this->money($totals['value'], $company),
            $this->percent($totals['change']),
        ];

        $document->section('Podio');

        if ($rows === []) {
            $document->paragraph('No hay producción registrada en este rango.');

            return $document->contents();
        }

        $document->table(
            self::HEADERS,
            $body,
            [0.7, 3.2, 1.5, 1, 1, 1, 1.6, 1.2],
            ['center', 'left', 'left', 'right', 'right', 'right', 'right', 'right'],
        );

        return $document->contents();
    }

    /**
     * @param  array{start: string, end: string}  $filters
     */
    public function filename(array $filters, string $extension): string
    {
        return 'ranking-produccion-'.$filters['start'].'-a-'.$filters['end'].'-'.now()->format('Ymd-Hi').'.'.$extension;
    }

    /**
     * Lineas de contexto del encabezado: sin ellas, un archivo suelto no dice de que
     * periodo es ni con que filtros se saco, que es justo lo que se pregunta al recibirlo.
     *
     * @param  array{start: string, end: string, only_confirmed: bool, reference_id: int|null, shift: string|null}  $filters
     * @param  array{start: string, end: string}  $previousPeriod
     * @return list<string>
     */
    protected function context(array $filters, array $previousPeriod, ?Company $company, ?string $referenceLabel): array
    {
        $lines = [];

        if ($company) {
            $lines[] = $company->name.($company->nit ? ' · NIT '.$company->nit : '');
        }

        $lines[] = 'Periodo: '.$this->date($filters['start']).' al '.$this->date($filters['end']);
        $lines[] = 'Comparado contra: '.$this->date($previousPeriod['start']).' al '.$this->date($previousPeriod['end']);

        $applied = [];
        if ($referenceLabel) {
            $applied[] = 'referencia '.$referenceLabel;
        }
        if ($filters['shift']) {
            $applied[] = 'turno '.(self::SHIFT_LABEL[$filters['shift']] ?? $filters['shift']);
        }
        if ($filters['only_confirmed']) {
            $applied[] = 'solo confirmadas';
        }

        $lines[] = 'Filtros: '.($applied === [] ? 'ninguno' : implode(' · ', $applied));
        $lines[] = 'Puntos = unidades × grado de dificultad de la operación. Generado el '.now()->format('d/m/Y H:i').'.';

        return $lines;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array{employees: int, quantity: int, points: int, records: int, value: float, change: float|null}
     */
    protected function totals(array $rows): array
    {
        $points = 0;
        $before = 0;
        $quantity = 0;
        $records = 0;
        $value = 0.0;

        foreach ($rows as $row) {
            $points += (int) $row['total_points'];
            $before += (int) $row['previous_points'];
            $quantity += (int) $row['total_quantity'];
            $records += (int) $row['records'];
            $value += (float) $row['total_value'];
        }

        return [
            'employees' => count($rows),
            'quantity' => $quantity,
            'points' => $points,
            'records' => $records,
            'value' => $value,
            'change' => $before === 0 ? null : round((($points - $before) / $before) * 100, 1),
        ];
    }

    /** @param array<string, mixed> $row */
    protected function name(array $row): string
    {
        return $row['employee']['full_name'] ?? ('Empleado #'.$row['employee_id']);
    }

    protected function currency(?Company $company): string
    {
        $settings = $company?->settings ?? [];

        return is_array($settings) ? (string) ($settings['currency'] ?? 'COP') : 'COP';
    }

    protected function date(string $value): string
    {
        return Carbon::parse($value)->format('d/m/Y');
    }

    protected function number(int|float $value): string
    {
        return number_format((float) $value, 0, ',', '.');
    }

    protected function money(int|float $value, ?Company $company): string
    {
        $symbols = ['COP' => '$', 'USD' => 'US$', 'EUR' => '€', 'MXN' => '$', 'PEN' => 'S/', 'CLP' => '$'];
        $currency = strtoupper($this->currency($company));

        return ($symbols[$currency] ?? $currency.' ').number_format((float) $value, 0, ',', '.');
    }

    protected function percent(?float $value): string
    {
        if ($value === null) {
            return 'nuevo';
        }

        return ($value > 0 ? '+' : '').number_format($value, 1, ',', '.').'%';
    }
}
