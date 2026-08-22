<?php

namespace App\Services\References;

use App\Models\Reference;
use App\Services\Files\StoredFileReader;
use App\Support\Xlsx\XlsxCell;
use App\Support\Xlsx\XlsxImage;
use App\Support\Xlsx\XlsxSheet;
use App\Support\Xlsx\XlsxStyle;
use App\Support\Xlsx\XlsxWorkbook;
use Illuminate\Support\Collection;

/**
 * Exporta referencias a Excel: una hoja resumen y una ficha completa por referencia.
 *
 * La foto viaja DENTRO del archivo (ver StoredFileReader), no como enlace: quien recibe
 * el Excel por correo tiene que ver la prenda sin acceso al sistema.
 *
 * Los numeros salen como numeros —no como texto ya formateado—, para que quien recibe el
 * archivo pueda sumar, filtrar y hacer tabla dinamica; el formato de moneda lo pone el
 * estilo de la celda.
 */
class ReferenceXlsxExport
{
    /** Imagenes mas pesadas que esto no se incrustan: harian el libro inmanejable. */
    private const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    private const THUMB_PX = 56;

    private const PHOTO_PX = 230;

    public function __construct(
        protected ReferenceExportData $data,
        protected StoredFileReader $files,
    ) {}

    /**
     * @param  Collection<int, Reference>  $references
     * @return string bytes del .xlsx
     */
    public function build(Collection $references): string
    {
        $payload = $this->data->build($references);
        $images = $this->images($references);

        $workbook = new XlsxWorkbook($payload['currency']);

        $this->summarySheet($workbook, $payload, $images);

        foreach ($payload['references'] as $reference) {
            $this->referenceSheet($workbook, $payload, $reference, $images[$reference['id']] ?? null);
        }

        return $workbook->contents();
    }

    /**
     * Nombre sugerido para el archivo descargado.
     *
     * @param  Collection<int, Reference>  $references
     */
    public function filename(Collection $references): string
    {
        $stamp = now()->format('Ymd-Hi');

        if ($references->count() === 1) {
            $code = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) $references->first()->code) ?: 'referencia';

            return 'referencia-'.trim($code, '-').'-'.$stamp.'.xlsx';
        }

        return 'referencias-'.$references->count().'-'.$stamp.'.xlsx';
    }

    /**
     * Bytes de la foto de cada referencia, ya validados como formato que Excel dibuja.
     *
     * @param  Collection<int, Reference>  $references
     * @return array<int, XlsxImage|null>
     */
    protected function images(Collection $references): array
    {
        $images = [];

        foreach ($references as $reference) {
            $stored = $reference->getAttributes()['image'] ?? null;
            $binary = $stored ? $this->files->contents($stored) : null;

            $images[$reference->id] = $binary !== null && strlen($binary) <= self::MAX_IMAGE_BYTES
                ? XlsxImage::fromBinary($binary)
                : null;
        }

        return $images;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<int, XlsxImage|null>  $images
     */
    protected function summarySheet(XlsxWorkbook $workbook, array $payload, array $images): void
    {
        $sheet = $workbook->addSheet('Resumen');
        $sheet->hideGridLines();
        $sheet->widths([10, 16, 32, 10, 11, 15, 18, 15, 10, 17, 19, 17, 12, 15, 14, 17, 12, 10, 42, 12, 12]);

        $totals = $payload['totals'];

        $sheet->row([XlsxCell::text($payload['company']['name'], XlsxStyle::TITLE)]);
        $sheet->row([XlsxCell::text('Catálogo de referencias · exportado el '.$payload['generated_at'], XlsxStyle::MUTED)]);
        $sheet->row([XlsxCell::text(sprintf(
            '%d referencias (%d activas · %d inactivas) · %d operaciones · valores en %s',
            $totals['references'],
            $totals['active'],
            $totals['inactive'],
            $totals['operations'],
            $payload['currency'],
        ), XlsxStyle::MUTED)]);
        $sheet->blank();

        $sheet->row([
            XlsxCell::text('Imagen', XlsxStyle::HEAD),
            XlsxCell::text('Código', XlsxStyle::HEAD),
            XlsxCell::text('Nombre', XlsxStyle::HEAD),
            XlsxCell::text('Estado', XlsxStyle::HEAD),
            XlsxCell::text('Lote (u.)', XlsxStyle::HEAD),
            XlsxCell::text('Pago por unidad', XlsxStyle::HEAD),
            XlsxCell::text('Costo operacional por unidad', XlsxStyle::HEAD),
            XlsxCell::text('Margen por unidad', XlsxStyle::HEAD),
            XlsxCell::text('Margen %', XlsxStyle::HEAD),
            XlsxCell::text('Total pago del lote', XlsxStyle::HEAD),
            XlsxCell::text('Total costo operacional del lote', XlsxStyle::HEAD),
            XlsxCell::text('Margen del lote', XlsxStyle::HEAD),
            XlsxCell::text('Operaciones', XlsxStyle::HEAD),
            XlsxCell::text('Operaciones completadas', XlsxStyle::HEAD),
            XlsxCell::text('Minutos totales', XlsxStyle::HEAD),
            XlsxCell::text('Producidas (op. más avanzada)', XlsxStyle::HEAD),
            XlsxCell::text('Pendientes', XlsxStyle::HEAD),
            XlsxCell::text('Avance', XlsxStyle::HEAD),
            XlsxCell::text('Descripción', XlsxStyle::HEAD),
            XlsxCell::text('Creada', XlsxStyle::HEAD),
            XlsxCell::text('Actualizada', XlsxStyle::HEAD),
        ], 32);
        $sheet->freezeRows(5);

        foreach ($payload['references'] as $reference) {
            $image = $images[$reference['id']] ?? null;

            $row = $sheet->row([
                XlsxCell::empty(XlsxStyle::BOX),
                XlsxCell::text($reference['code'], XlsxStyle::BOX),
                XlsxCell::text($reference['name'], XlsxStyle::BOX),
                XlsxCell::text($reference['status_label'], XlsxStyle::BOX),
                XlsxCell::number($reference['lot_total_quantity'], XlsxStyle::INTEGER),
                $reference['payment_defined']
                    ? XlsxCell::number($reference['payment_per_unit'], XlsxStyle::MONEY)
                    : XlsxCell::text('Sin definir', XlsxStyle::BOX),
                XlsxCell::number($reference['operational_cost_per_unit'], XlsxStyle::MONEY),
                XlsxCell::number($reference['margin_per_unit'], XlsxStyle::MONEY),
                XlsxCell::number($reference['margin_ratio'], XlsxStyle::PERCENT),
                XlsxCell::number($reference['lot_payment_total'], XlsxStyle::MONEY),
                XlsxCell::number($reference['lot_operational_total'], XlsxStyle::MONEY),
                XlsxCell::number($reference['lot_margin_total'], XlsxStyle::MONEY),
                XlsxCell::number($reference['operations_count'], XlsxStyle::INTEGER),
                XlsxCell::number($reference['operations_completed_count'], XlsxStyle::INTEGER),
                XlsxCell::number($reference['total_minutes'], XlsxStyle::DECIMAL),
                XlsxCell::number($reference['produced_max_per_operation'], XlsxStyle::INTEGER),
                XlsxCell::number($reference['pending_units'], XlsxStyle::INTEGER),
                XlsxCell::number($reference['progress_ratio'], XlsxStyle::PERCENT),
                XlsxCell::text($reference['description'], XlsxStyle::BOX),
                XlsxCell::text($reference['created_at'], XlsxStyle::BOX),
                XlsxCell::text($reference['updated_at'], XlsxStyle::BOX),
            ], 46);

            if ($image !== null) {
                $sheet->image($image, 0, $row, self::THUMB_PX, self::THUMB_PX);
            }
        }

        $sheet->row([
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::text('TOTAL', XlsxStyle::BOX_TOTAL),
            XlsxCell::text($totals['references'].' referencias', XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::number($totals['lot_units'], XlsxStyle::INTEGER_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::number($totals['lot_payment_total'], XlsxStyle::MONEY_TOTAL),
            XlsxCell::number($totals['lot_operational_total'], XlsxStyle::MONEY_TOTAL),
            XlsxCell::number($totals['lot_margin_total'], XlsxStyle::MONEY_TOTAL),
            XlsxCell::number($totals['operations'], XlsxStyle::INTEGER_TOTAL),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $reference
     */
    protected function referenceSheet(XlsxWorkbook $workbook, array $payload, array $reference, ?XlsxImage $image): void
    {
        $sheet = $workbook->addSheet($reference['code']);
        $sheet->hideGridLines();
        $sheet->widths([34, 26, 13, 13, 15, 13, 13, 15, 15, 44]);

        $sheet->row([XlsxCell::text($reference['code'].' · '.$reference['name'], XlsxStyle::TITLE)], 22);
        $sheet->merge(0, 0, 3, 0);
        $sheet->row([XlsxCell::text(
            'Ficha completa · '.$payload['company']['name'].' · exportada el '.$payload['generated_at'],
            XlsxStyle::MUTED,
        )]);
        $sheet->merge(0, 1, 3, 1);
        $sheet->blank();

        /* ------------------------------------------------------------ Identidad */

        $sheet->row([XlsxCell::text('Identidad', XlsxStyle::SECTION)]);
        $imageRow = $sheet->cursor();

        $this->pair($sheet, 'Código', XlsxCell::text($reference['code'], XlsxStyle::BOX));
        $this->pair($sheet, 'Nombre', XlsxCell::text($reference['name'], XlsxStyle::BOX));
        $this->pair($sheet, 'Estado', XlsxCell::text($reference['status_label'], XlsxStyle::BOX));
        $this->pair($sheet, 'Descripción', XlsxCell::text($reference['description'] ?: 'Sin descripción.', XlsxStyle::BOX), 42);
        $this->pair($sheet, 'Creada', XlsxCell::text($reference['created_at'], XlsxStyle::BOX));
        $this->pair($sheet, 'Última actualización', XlsxCell::text($reference['updated_at'], XlsxStyle::BOX));

        if ($image !== null) {
            // La foto se ancla a la derecha de la ficha, sin empujar ninguna celda.
            $sheet->image($image, 4, $imageRow, self::PHOTO_PX, self::PHOTO_PX);
        } else {
            $sheet->row([
                XlsxCell::empty(),
                XlsxCell::empty(),
                XlsxCell::empty(),
                XlsxCell::empty(),
                XlsxCell::text(
                    $reference['image_url']
                        ? 'La imagen no se pudo incrustar; consúltela en el sistema o en el PDF.'
                        : 'Sin imagen cargada.',
                    XlsxStyle::MUTED,
                ),
            ]);
        }

        $sheet->blank();

        /* -------------------------------------------------------- Dinero y lote */

        $sheet->row([XlsxCell::text('Dinero y lote', XlsxStyle::SECTION)]);
        $this->pair($sheet, 'Cantidad total del lote (u.)', XlsxCell::number($reference['lot_total_quantity'], XlsxStyle::INTEGER));
        $this->pair($sheet, 'Valor unitario de pago', $reference['payment_defined']
            ? XlsxCell::number($reference['payment_per_unit'], XlsxStyle::MONEY)
            : XlsxCell::text('Sin definir', XlsxStyle::BOX));
        $this->pair($sheet, 'Costo operacional por unidad', XlsxCell::number($reference['operational_cost_per_unit'], XlsxStyle::MONEY));
        $this->pair($sheet, 'Margen por unidad', XlsxCell::number($reference['margin_per_unit'], XlsxStyle::MONEY));
        $this->pair($sheet, 'Margen sobre el pago', XlsxCell::number($reference['margin_ratio'], XlsxStyle::PERCENT));
        $this->pair($sheet, 'Total pago del lote', XlsxCell::number($reference['lot_payment_total'], XlsxStyle::MONEY_TOTAL));
        $this->pair($sheet, 'Total costo operacional del lote', XlsxCell::number($reference['lot_operational_total'], XlsxStyle::MONEY_TOTAL));
        $this->pair($sheet, 'Margen del lote', XlsxCell::number($reference['lot_margin_total'], XlsxStyle::MONEY_TOTAL));

        $sheet->row([XlsxCell::text(sprintf(
            'Costo operacional = suma de los precios de las %d operaciones de la referencia (activas y cerradas). '
            .'Total del lote = costo operacional por unidad × %s unidades. Valores en %s.',
            $reference['operations_count'],
            number_format((float) $reference['lot_total_quantity'], 0, ',', '.'),
            $payload['currency'],
        ), XlsxStyle::MUTED)]);

        $sheet->blank();

        /* --------------------------------------------------- Produccion del lote */

        $sheet->row([XlsxCell::text('Producción registrada', XlsxStyle::SECTION)]);
        $this->pair($sheet, 'Unidades de la operación más avanzada', XlsxCell::number($reference['produced_max_per_operation'], XlsxStyle::INTEGER));
        $this->pair($sheet, 'Unidades pendientes del lote', XlsxCell::number($reference['pending_units'], XlsxStyle::INTEGER));
        $this->pair($sheet, 'Avance del lote', XlsxCell::number($reference['progress_ratio'], XlsxStyle::PERCENT));
        $this->pair($sheet, 'Operaciones completadas', XlsxCell::text(
            $reference['operations_completed_count'].' de '.$reference['operations_count'],
            XlsxStyle::BOX,
        ));
        $this->pair($sheet, 'Producción acumulada (todas las operaciones)', XlsxCell::number($reference['produced_total'], XlsxStyle::INTEGER));

        $sheet->blank();

        /* ------------------------------------------------------------ Operaciones */

        $sheet->row([XlsxCell::text('Operaciones · detalle del costo operacional', XlsxStyle::SECTION)]);

        if ($reference['operations'] === []) {
            $sheet->row([XlsxCell::text('La referencia no tiene operaciones vinculadas.', XlsxStyle::MUTED)]);

            return;
        }

        $sheet->row([
            XlsxCell::text('Operación', XlsxStyle::HEAD),
            XlsxCell::text('Precio por unidad', XlsxStyle::HEAD),
            XlsxCell::text('% del costo', XlsxStyle::HEAD),
            XlsxCell::text('Minutos', XlsxStyle::HEAD),
            XlsxCell::text('Dificultad', XlsxStyle::HEAD),
            XlsxCell::text('Estado', XlsxStyle::HEAD),
            XlsxCell::text('Producidas', XlsxStyle::HEAD),
            XlsxCell::text('Pendientes', XlsxStyle::HEAD),
            XlsxCell::text('Total en el lote', XlsxStyle::HEAD),
            XlsxCell::text('Descripción', XlsxStyle::HEAD),
        ], 32);

        foreach ($reference['operations'] as $line) {
            $sheet->row([
                XlsxCell::text($line['name'], XlsxStyle::BOX),
                XlsxCell::number($line['price'], XlsxStyle::MONEY),
                XlsxCell::number($line['cost_share'], XlsxStyle::PERCENT),
                XlsxCell::number($line['minutes'], XlsxStyle::DECIMAL),
                XlsxCell::text(
                    $line['difficulty_label'].($line['minutes_inherited'] ? ' (heredada)' : ''),
                    XlsxStyle::BOX,
                ),
                XlsxCell::text($line['status_label'], XlsxStyle::BOX),
                XlsxCell::number($line['produced'], XlsxStyle::INTEGER),
                XlsxCell::number($line['pending'], XlsxStyle::INTEGER),
                XlsxCell::number($line['lot_total'], XlsxStyle::MONEY),
                XlsxCell::text($line['description'], XlsxStyle::BOX),
            ]);
        }

        $sheet->row([
            XlsxCell::text('Costo operacional por unidad', XlsxStyle::BOX_TOTAL),
            XlsxCell::number($reference['operational_cost_per_unit'], XlsxStyle::MONEY_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::number($reference['total_minutes'], XlsxStyle::DECIMAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
            XlsxCell::number($reference['lot_operational_total'], XlsxStyle::MONEY_TOTAL),
            XlsxCell::empty(XlsxStyle::BOX_TOTAL),
        ]);
    }

    /**
     * Fila «etiqueta / valor» con el valor combinado en B:D, para que respire.
     */
    protected function pair(XlsxSheet $sheet, string $label, XlsxCell $value, ?float $height = null): void
    {
        $row = $sheet->row([
            XlsxCell::text($label, XlsxStyle::LABEL),
            $value,
            XlsxCell::empty($value->style),
            XlsxCell::empty($value->style),
        ], $height);

        $sheet->merge(1, $row, 3, $row);
    }
}
