<?php

namespace App\Support\Xlsx;

/**
 * Una hoja del libro: filas, anchos de columna, combinaciones e imagenes ancladas.
 *
 * Todas las coordenadas que recibe son base cero (columna 0 = A, fila 0 = 1) y se
 * traducen a referencias de Excel al escribir el XML.
 */
class XlsxSheet
{
    /** @var list<array{cells: list<XlsxCell>, height: float|null}> */
    protected array $rows = [];

    /** @var array<int, float> ancho en caracteres por indice de columna */
    protected array $widths = [];

    /** @var list<array{0:int,1:int,2:int,3:int}> */
    protected array $merges = [];

    /** @var list<array{image: XlsxImage, col: int, row: int, width: int, height: int}> */
    protected array $images = [];

    protected ?int $freezeRow = null;

    protected bool $gridLines = true;

    public function __construct(public readonly string $name) {}

    /**
     * Agrega una fila. Los escalares se aceptan tal cual; para elegir estilo use XlsxCell.
     *
     * @param  list<mixed>  $cells
     * @return int indice (base cero) de la fila agregada
     */
    public function row(array $cells = [], ?float $height = null): int
    {
        $this->rows[] = [
            'cells' => array_values(array_map(fn ($c) => XlsxCell::from($c), $cells)),
            'height' => $height,
        ];

        return count($this->rows) - 1;
    }

    /**
     * Fila de dos columnas: etiqueta y valor. Es el patron de las fichas.
     */
    public function labelled(string $label, mixed $value, int $valueStyle = XlsxStyle::BOX): int
    {
        return $this->row([XlsxCell::text($label, XlsxStyle::LABEL), XlsxCell::from($value, $valueStyle)]);
    }

    public function blank(int $count = 1): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->row();
        }
    }

    /** Proxima fila que se escribiria (base cero). */
    public function cursor(): int
    {
        return count($this->rows);
    }

    /**
     * @param  array<int, float>  $widths  ancho por columna, en orden desde A
     */
    public function widths(array $widths): static
    {
        foreach (array_values($widths) as $index => $width) {
            $this->widths[$index] = (float) $width;
        }

        return $this;
    }

    public function merge(int $fromCol, int $fromRow, int $toCol, int $toRow): static
    {
        $this->merges[] = [$fromCol, $fromRow, $toCol, $toRow];

        return $this;
    }

    public function image(XlsxImage $image, int $col, int $row, int $maxWidthPx, int $maxHeightPx): static
    {
        [$w, $h] = $image->fitInside($maxWidthPx, $maxHeightPx);
        $this->images[] = ['image' => $image, 'col' => $col, 'row' => $row, 'width' => $w, 'height' => $h];

        return $this;
    }

    /** Congela las primeras $rows filas al desplazarse. */
    public function freezeRows(int $rows): static
    {
        $this->freezeRow = $rows;

        return $this;
    }

    public function hideGridLines(): static
    {
        $this->gridLines = false;

        return $this;
    }

    /**
     * @return list<array{image: XlsxImage, col: int, row: int, width: int, height: int}>
     */
    public function imagesList(): array
    {
        return $this->images;
    }

    /**
     * XML de la hoja. $drawingRelId es null cuando la hoja no lleva imagenes.
     */
    public function toXml(?string $drawingRelId): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            .' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

        $xml .= '<sheetViews><sheetView workbookViewId="0"'.($this->gridLines ? '' : ' showGridLines="0"').'>';
        if ($this->freezeRow !== null && $this->freezeRow > 0) {
            $top = $this->freezeRow + 1;
            $xml .= '<pane ySplit="'.$this->freezeRow.'" topLeftCell="A'.$top.'" activePane="bottomLeft" state="frozen"/>'
                .'<selection pane="bottomLeft" activeCell="A'.$top.'" sqref="A'.$top.'"/>';
        }
        $xml .= '</sheetView></sheetViews>';

        $xml .= '<sheetFormatPr defaultRowHeight="15"/>';

        if ($this->widths !== []) {
            $xml .= '<cols>';
            foreach ($this->widths as $index => $width) {
                $col = $index + 1;
                $xml .= '<col min="'.$col.'" max="'.$col.'" width="'.round($width, 2).'" customWidth="1"/>';
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';
        foreach ($this->rows as $index => $row) {
            $number = $index + 1;
            $height = $row['height'] !== null ? ' ht="'.round($row['height'], 2).'" customHeight="1"' : '';
            $cells = '';

            foreach ($row['cells'] as $col => $cell) {
                $ref = self::columnName($col).$number;
                $style = $cell->style !== 0 ? ' s="'.$cell->style.'"' : '';

                if ($cell->type === 'n') {
                    $cells .= '<c r="'.$ref.'"'.$style.'><v>'.self::numberValue($cell->value).'</v></c>';
                } elseif ($cell->type === 's') {
                    $cells .= '<c r="'.$ref.'"'.$style.' t="inlineStr"><is><t xml:space="preserve">'
                        .self::escape((string) $cell->value).'</t></is></c>';
                } elseif ($cell->style !== 0) {
                    // Celda vacia con estilo: sostiene el borde de la tabla.
                    $cells .= '<c r="'.$ref.'"'.$style.'/>';
                }
            }

            if ($cells === '' && $height === '') {
                continue;
            }

            $xml .= '<row r="'.$number.'"'.$height.'>'.$cells.'</row>';
        }
        $xml .= '</sheetData>';

        if ($this->merges !== []) {
            $xml .= '<mergeCells count="'.count($this->merges).'">';
            foreach ($this->merges as [$c1, $r1, $c2, $r2]) {
                $xml .= '<mergeCell ref="'.self::columnName($c1).($r1 + 1).':'.self::columnName($c2).($r2 + 1).'"/>';
            }
            $xml .= '</mergeCells>';
        }

        $xml .= '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
        $xml .= '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>';

        if ($drawingRelId !== null) {
            $xml .= '<drawing r:id="'.$drawingRelId.'"/>';
        }

        return $xml.'</worksheet>';
    }

    public static function columnName(int $index): string
    {
        $name = '';
        $index++;

        while ($index > 0) {
            $rest = ($index - 1) % 26;
            $name = chr(65 + $rest).$name;
            $index = intdiv($index - 1, 26);
        }

        return $name;
    }

    private static function numberValue(mixed $value): string
    {
        if (is_int($value)) {
            return (string) $value;
        }

        // Sin notacion cientifica ni coma decimal: Excel solo lee el punto.
        $formatted = rtrim(rtrim(number_format((float) $value, 6, '.', ''), '0'), '.');

        return $formatted === '' || $formatted === '-' ? '0' : $formatted;
    }

    public static function escape(string $value): string
    {
        // Los caracteres de control rompen el XML de Excel aunque escapen bien.
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? $value;

        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
