<?php

namespace App\Support\Docx;

use RuntimeException;
use ZipArchive;

/**
 * Generador minimo de documentos .docx (OOXML) escrito a mano.
 *
 * Mismo criterio que `XlsxWorkbook`: el proyecto no trae PhpWord y lo que hace falta es un
 * archivo que Word abra tal cual, no una libreria general. Cubre lo justo —titulo,
 * parrafos, cabecera de seccion y tablas con encabezado— que es lo que llevan los
 * documentos que exporta el ERP.
 *
 * Uso:
 *   $doc = new DocxDocument('Ranking de producción');
 *   $doc->paragraph('Del 01/09/2026 al 15/09/2026', DocxDocument::MUTED);
 *   $doc->table(['Puesto', 'Empleado'], [['1', 'Ana Ruiz']]);
 *   return $doc->contents();
 */
class DocxDocument
{
    /** Texto normal. */
    public const BODY = 'body';

    /** Texto gris de apoyo. */
    public const MUTED = 'muted';

    /** Texto resaltado. */
    public const BOLD = 'bold';

    /** Ancho util de la pagina en twips (carta menos margenes de 1"). */
    private const CONTENT_TWIPS = 9360;

    /** @var list<string> bloques XML ya resueltos, en orden */
    protected array $blocks = [];

    public function __construct(string $title)
    {
        $this->heading($title);
    }

    /** Titulo del documento. */
    public function heading(string $text): static
    {
        $this->blocks[] = $this->paragraphXml($text, [
            'size' => 36,
            'bold' => true,
            'spacingAfter' => 60,
        ]);

        return $this;
    }

    /** Titulo de una seccion dentro del documento. */
    public function section(string $text): static
    {
        $this->blocks[] = $this->paragraphXml($text, [
            'size' => 24,
            'bold' => true,
            'spacingBefore' => 280,
            'spacingAfter' => 80,
        ]);

        return $this;
    }

    public function paragraph(string $text, string $style = self::BODY): static
    {
        $this->blocks[] = $this->paragraphXml($text, [
            'size' => 20,
            'bold' => $style === self::BOLD,
            'color' => $style === self::MUTED ? '64748B' : null,
            'spacingAfter' => 60,
        ]);

        return $this;
    }

    /**
     * Tabla con fila de encabezado.
     *
     * `$widths` son proporciones (no hace falta que sumen nada concreto): se reparten
     * sobre el ancho util de la pagina. Sin ellas, las columnas quedan iguales.
     *
     * `$alignments` acepta 'left', 'right' o 'center' por columna; los numeros van a la
     * derecha para que se puedan comparar de un vistazo, igual que en la pantalla.
     *
     * @param  list<string>  $headers
     * @param  list<list<string>>  $rows
     * @param  list<float>  $widths
     * @param  list<string>  $alignments
     */
    public function table(array $headers, array $rows, array $widths = [], array $alignments = []): static
    {
        $columns = count($headers);

        if ($columns === 0) {
            return $this;
        }

        $grid = $this->grid($columns, $widths);

        $xml = '<w:tbl>'
            .'<w:tblPr>'
            .'<w:tblW w:w="'.self::CONTENT_TWIPS.'" w:type="dxa"/>'
            .'<w:tblBorders>'
            .$this->border('top').$this->border('left').$this->border('bottom')
            .$this->border('right').$this->border('insideH').$this->border('insideV')
            .'</w:tblBorders>'
            .'<w:tblCellMar>'
            .'<w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
            .'<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/>'
            .'</w:tblCellMar>'
            .'</w:tblPr>'
            .'<w:tblGrid>';

        foreach ($grid as $width) {
            $xml .= '<w:gridCol w:w="'.$width.'"/>';
        }

        $xml .= '</w:tblGrid>';

        // `tblHeader` repite el encabezado si la tabla parte de pagina, que es lo normal
        // en un ranking largo.
        $xml .= $this->rowXml($headers, $grid, $alignments, true);

        foreach ($rows as $row) {
            $xml .= $this->rowXml(array_values($row), $grid, $alignments, false);
        }

        $this->blocks[] = $xml.'</w:tbl>';

        // Word necesita un parrafo tras la tabla; sin el, dos tablas seguidas se funden.
        $this->blocks[] = '<w:p/>';

        return $this;
    }

    /**
     * Bytes del archivo .docx.
     *
     * ZipArchive solo escribe sobre disco, asi que se arma en un temporal y se devuelve su
     * contenido; el archivo se borra siempre, incluso si algo falla al leerlo.
     */
    public function contents(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'docx');

        if ($path === false) {
            throw new RuntimeException('No se pudo crear el archivo temporal del Word.');
        }

        try {
            $this->save($path);
            $bytes = file_get_contents($path);

            if ($bytes === false) {
                throw new RuntimeException('No se pudo leer el Word generado.');
            }

            return $bytes;
        } finally {
            @unlink($path);
        }
    }

    public function save(string $path): void
    {
        $zip = new ZipArchive;

        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('No se pudo crear el archivo Word.');
        }

        $zip->addFromString('[Content_Types].xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/word/document.xml"'
            .' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'<Override PartName="/word/styles.xml"'
            .' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            .'</Types>');

        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1"'
            .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
            .' Target="word/document.xml"/>'
            .'</Relationships>');

        $zip->addFromString('word/_rels/document.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1"'
            .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"'
            .' Target="styles.xml"/>'
            .'</Relationships>');

        $zip->addFromString('word/styles.xml', $this->stylesXml());
        $zip->addFromString('word/document.xml', $this->documentXml());

        if ($zip->close() !== true) {
            throw new RuntimeException('No se pudo cerrar el archivo Word.');
        }
    }

    protected function documentXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:body>'
            .implode('', $this->blocks)
            // Carta apaisada: un ranking tiene mas columnas que texto.
            .'<w:sectPr>'
            .'<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>'
            .'<w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080"'
            .' w:header="720" w:footer="720" w:gutter="0"/>'
            .'</w:sectPr>'
            .'</w:body>'
            .'</w:document>';
    }

    protected function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:docDefaults><w:rPrDefault><w:rPr>'
            .'<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
            .'<w:sz w:val="20"/><w:szCs w:val="20"/>'
            .'</w:rPr></w:rPrDefault></w:docDefaults>'
            .'</w:styles>';
    }

    /**
     * Ancho en twips de cada columna.
     *
     * @param  list<float>  $widths
     * @return list<int>
     */
    protected function grid(int $columns, array $widths): array
    {
        $widths = array_slice(array_values($widths), 0, $columns);

        // Sin proporciones (o incompletas), lo que falte se reparte a partes iguales.
        while (count($widths) < $columns) {
            $widths[] = 1.0;
        }

        $total = array_sum($widths);

        if ($total <= 0) {
            $widths = array_fill(0, $columns, 1.0);
            $total = $columns;
        }

        $grid = [];
        $used = 0;

        foreach ($widths as $index => $width) {
            // La ultima columna absorbe el redondeo: si no, la tabla no cierra en el margen.
            $value = $index === $columns - 1
                ? self::CONTENT_TWIPS - $used
                : (int) round(self::CONTENT_TWIPS * ($width / $total));

            $grid[] = max(1, $value);
            $used += $value;
        }

        return $grid;
    }

    /**
     * @param  list<string>  $cells
     * @param  list<int>  $grid
     * @param  list<string>  $alignments
     */
    protected function rowXml(array $cells, array $grid, array $alignments, bool $header): string
    {
        $xml = '<w:tr>';

        if ($header) {
            $xml .= '<w:trPr><w:tblHeader/></w:trPr>';
        }

        foreach ($grid as $index => $width) {
            $align = $alignments[$index] ?? 'left';

            $xml .= '<w:tc>'
                .'<w:tcPr>'
                .'<w:tcW w:w="'.$width.'" w:type="dxa"/>'
                .($header ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF1F6"/>' : '')
                .'<w:vAlign w:val="center"/>'
                .'</w:tcPr>'
                .$this->paragraphXml((string) ($cells[$index] ?? ''), [
                    'size' => 18,
                    'bold' => $header,
                    'align' => $align,
                    'spacingAfter' => 0,
                ])
                .'</w:tc>';
        }

        return $xml.'</w:tr>';
    }

    /**
     * @param  array{size?: int, bold?: bool, color?: string|null, align?: string, spacingBefore?: int, spacingAfter?: int}  $options
     */
    protected function paragraphXml(string $text, array $options = []): string
    {
        $properties = '';

        if (($options['align'] ?? 'left') !== 'left') {
            $properties .= '<w:jc w:val="'.$options['align'].'"/>';
        }

        $before = $options['spacingBefore'] ?? 0;
        $after = $options['spacingAfter'] ?? 0;
        $properties .= '<w:spacing w:before="'.$before.'" w:after="'.$after.'"/>';

        $run = '';
        if (! empty($options['bold'])) {
            $run .= '<w:b/>';
        }
        if (! empty($options['color'])) {
            $run .= '<w:color w:val="'.$options['color'].'"/>';
        }
        $size = $options['size'] ?? 20;
        $run .= '<w:sz w:val="'.$size.'"/><w:szCs w:val="'.$size.'"/>';

        return '<w:p>'
            .'<w:pPr>'.$properties.'</w:pPr>'
            .'<w:r>'
            .'<w:rPr>'.$run.'</w:rPr>'
            // `xml:space` conserva los espacios: sin el, Word recorta los extremos.
            .'<w:t xml:space="preserve">'.$this->escape($text).'</w:t>'
            .'</w:r>'
            .'</w:p>';
    }

    protected function border(string $side): string
    {
        return '<w:'.$side.' w:val="single" w:sz="4" w:space="0" w:color="D5DAE3"/>';
    }

    /** Los caracteres de control rompen el XML de Word aunque el texto se vea bien. */
    protected function escape(string $value): string
    {
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? $value;

        return htmlspecialchars($clean, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
