<?php

namespace App\Support\Xlsx;

use RuntimeException;
use ZipArchive;

/**
 * Generador minimo de libros .xlsx (OOXML) escrito a mano.
 *
 * El proyecto no trae PhpSpreadsheet y la exportacion de referencias necesita algo que
 * Excel abra tal cual —con la foto de la prenda dentro del archivo, no un enlace—, asi
 * que aqui se arma el ZIP con las partes justas: libro, hojas, estilos, dibujos y medios.
 * Cubre lo que usan los documentos del ERP; no pretende ser una libreria general.
 *
 * Uso:
 *   $wb = new XlsxWorkbook('COP');
 *   $hoja = $wb->addSheet('Resumen');
 *   $hoja->row([XlsxCell::text('Codigo', XlsxStyle::HEAD)]);
 *   return $wb->contents();
 */
class XlsxWorkbook
{
    /** Un pixel en EMU (unidad de los dibujos de OOXML). */
    private const EMU_PER_PIXEL = 9525;

    /** @var list<XlsxSheet> */
    protected array $sheets = [];

    protected string $currencyFormat;

    public function __construct(string $currency = 'COP')
    {
        $this->currencyFormat = self::currencyFormatFor($currency);
    }

    public function addSheet(string $name): XlsxSheet
    {
        $sheet = new XlsxSheet($this->uniqueSheetName($name));
        $this->sheets[] = $sheet;

        return $sheet;
    }

    /** @return list<XlsxSheet> */
    public function sheets(): array
    {
        return $this->sheets;
    }

    /**
     * Bytes del archivo .xlsx.
     *
     * ZipArchive solo escribe sobre disco, asi que se arma en un temporal y se devuelve
     * su contenido; el archivo se borra siempre, incluso si algo falla al leerlo.
     */
    public function contents(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');

        if ($path === false) {
            throw new RuntimeException('No se pudo crear el archivo temporal del Excel.');
        }

        try {
            $this->save($path);
            $bytes = file_get_contents($path);

            if ($bytes === false) {
                throw new RuntimeException('No se pudo leer el Excel generado.');
            }

            return $bytes;
        } finally {
            @unlink($path);
        }
    }

    public function save(string $path): void
    {
        if ($this->sheets === []) {
            $this->addSheet('Hoja 1');
        }

        $zip = new ZipArchive;

        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('No se pudo crear el archivo Excel.');
        }

        $mediaExtensions = [];
        $mediaFiles = [];
        $drawings = [];

        foreach ($this->sheets as $index => $sheet) {
            $images = $sheet->imagesList();

            if ($images === []) {
                $drawings[$index] = null;

                continue;
            }

            $rels = '';
            $anchors = '';

            foreach ($images as $position => $item) {
                $extension = $item['image']->extension;
                $hash = md5($item['image']->data);

                // La misma foto suele ir en la hoja resumen y en la de la referencia:
                // se guarda una sola vez y las dos hojas apuntan al mismo archivo.
                if (! isset($mediaFiles[$hash])) {
                    $file = 'image'.(count($mediaFiles) + 1).'.'.$extension;
                    $mediaFiles[$hash] = $file;
                    $mediaExtensions[$extension] = true;
                    $zip->addFromString('xl/media/'.$file, $item['image']->data);
                }

                $file = $mediaFiles[$hash];

                $relId = 'rId'.($position + 1);
                $rels .= '<Relationship Id="'.$relId.'"'
                    .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"'
                    .' Target="../media/'.$file.'"/>';

                $anchors .= $this->anchorXml($item, $relId, $position + 1);
            }

            $number = $index + 1;

            $zip->addFromString('xl/drawings/drawing'.$number.'.xml',
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                .'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"'
                .' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
                .' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                .$anchors
                .'</xdr:wsDr>');

            $zip->addFromString('xl/drawings/_rels/drawing'.$number.'.xml.rels',
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                .$rels
                .'</Relationships>');

            $zip->addFromString('xl/worksheets/_rels/sheet'.$number.'.xml.rels',
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                .'<Relationship Id="rId1"'
                .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing"'
                .' Target="../drawings/drawing'.$number.'.xml"/>'
                .'</Relationships>');

            $drawings[$index] = 'rId1';
        }

        foreach ($this->sheets as $index => $sheet) {
            $zip->addFromString('xl/worksheets/sheet'.($index + 1).'.xml', $sheet->toXml($drawings[$index] ?? null));
        }

        $zip->addFromString('[Content_Types].xml', $this->contentTypesXml(array_keys($mediaExtensions), $drawings));
        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1"'
            .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
            .' Target="xl/workbook.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/workbook.xml', $this->workbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRelsXml());
        $zip->addFromString('xl/styles.xml', $this->stylesXml());

        if ($zip->close() !== true) {
            throw new RuntimeException('No se pudo cerrar el archivo Excel.');
        }
    }

    /**
     * @param  array{image: XlsxImage, col: int, row: int, width: int, height: int}  $item
     */
    protected function anchorXml(array $item, string $relId, int $id): string
    {
        $cx = $item['width'] * self::EMU_PER_PIXEL;
        $cy = $item['height'] * self::EMU_PER_PIXEL;

        // Anclaje de una celda: la imagen conserva su tamano aunque cambien las columnas.
        return '<xdr:oneCellAnchor>'
            .'<xdr:from>'
            .'<xdr:col>'.$item['col'].'</xdr:col><xdr:colOff>0</xdr:colOff>'
            .'<xdr:row>'.$item['row'].'</xdr:row><xdr:rowOff>0</xdr:rowOff>'
            .'</xdr:from>'
            .'<xdr:ext cx="'.$cx.'" cy="'.$cy.'"/>'
            .'<xdr:pic>'
            .'<xdr:nvPicPr>'
            .'<xdr:cNvPr id="'.$id.'" name="Imagen '.$id.'"/>'
            .'<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>'
            .'</xdr:nvPicPr>'
            .'<xdr:blipFill><a:blip r:embed="'.$relId.'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
            .'<xdr:spPr>'
            .'<a:xfrm><a:off x="0" y="0"/><a:ext cx="'.$cx.'" cy="'.$cy.'"/></a:xfrm>'
            .'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            .'</xdr:spPr>'
            .'</xdr:pic>'
            .'<xdr:clientData/>'
            .'</xdr:oneCellAnchor>';
    }

    /**
     * @param  list<string>  $mediaExtensions
     * @param  array<int, string|null>  $drawings
     */
    protected function contentTypesXml(array $mediaExtensions, array $drawings): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>';

        foreach ($mediaExtensions as $extension) {
            $xml .= '<Default Extension="'.$extension.'" ContentType="image/'.$extension.'"/>';
        }

        $xml .= '<Override PartName="/xl/workbook.xml"'
            .' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/styles.xml"'
            .' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';

        foreach (array_keys($this->sheets) as $index) {
            $xml .= '<Override PartName="/xl/worksheets/sheet'.($index + 1).'.xml"'
                .' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';

            if (($drawings[$index] ?? null) !== null) {
                $xml .= '<Override PartName="/xl/drawings/drawing'.($index + 1).'.xml"'
                    .' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
            }
        }

        return $xml.'</Types>';
    }

    protected function workbookXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            .' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets>';

        foreach ($this->sheets as $index => $sheet) {
            $xml .= '<sheet name="'.XlsxSheet::escape($sheet->name).'" sheetId="'.($index + 1).'"'
                .' r:id="rId'.($index + 1).'"/>';
        }

        return $xml.'</sheets></workbook>';
    }

    protected function workbookRelsXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

        foreach (array_keys($this->sheets) as $index) {
            $xml .= '<Relationship Id="rId'.($index + 1).'"'
                .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"'
                .' Target="worksheets/sheet'.($index + 1).'.xml"/>';
        }

        $xml .= '<Relationship Id="rId'.(count($this->sheets) + 1).'"'
            .' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"'
            .' Target="styles.xml"/>';

        return $xml.'</Relationships>';
    }

    /**
     * Catalogo fijo de estilos; el orden de <cellXfs> es el de las constantes XlsxStyle.
     */
    protected function stylesXml(): string
    {
        $currency = XlsxSheet::escape($this->currencyFormat);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<numFmts count="2">'
            .'<numFmt numFmtId="164" formatCode="'.$currency.'"/>'
            .'<numFmt numFmtId="165" formatCode="#,##0.0"/>'
            .'</numFmts>'
            .'<fonts count="6">'
            .'<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font>'
            .'<font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
            .'<font><b/><sz val="12"/><color rgb="FF3730A3"/><name val="Calibri"/></font>'
            .'</fonts>'
            .'<fills count="5">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="gray125"/></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FF312E81"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill>'
            .'</fills>'
            .'<borders count="2">'
            .'<border><left/><right/><top/><bottom/><diagonal/></border>'
            .'<border>'
            .'<left style="thin"><color rgb="FFD1D5DB"/></left>'
            .'<right style="thin"><color rgb="FFD1D5DB"/></right>'
            .'<top style="thin"><color rgb="FFD1D5DB"/></top>'
            .'<bottom style="thin"><color rgb="FFD1D5DB"/></bottom>'
            .'<diagonal/>'
            .'</border>'
            .'</borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="16">'
            // 0 DEFAULT
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            // 1 BOLD
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 2 TITLE
            .'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 3 MUTED
            .'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 4 HEAD
            .'<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"'
            .' applyBorder="1" applyAlignment="1">'
            .'<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            // 5 LABEL
            .'<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"'
            .' applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
            // 6 BOX
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">'
            .'<alignment vertical="center" wrapText="1"/></xf>'
            // 7 MONEY
            .'<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"'
            .' applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 8 MONEY_TOTAL
            .'<xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1"'
            .' applyFill="1" applyBorder="1" applyAlignment="1">'
            .'<alignment horizontal="right" vertical="center"/></xf>'
            // 9 INTEGER
            .'<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"'
            .' applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 10 DECIMAL
            .'<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"'
            .' applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 11 PERCENT
            .'<xf numFmtId="9" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"'
            .' applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
            // 12 SECTION
            .'<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 13 WRAP
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'
            .'<alignment vertical="top" wrapText="1"/></xf>'
            // 14 INTEGER_TOTAL
            .'<xf numFmtId="3" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1"'
            .' applyFill="1" applyBorder="1" applyAlignment="1">'
            .'<alignment horizontal="right" vertical="center"/></xf>'
            // 15 BOX_TOTAL
            .'<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1"'
            .' applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
            .'</cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'</styleSheet>';
    }

    /**
     * Formato de numero para la moneda de la empresa.
     */
    public static function currencyFormatFor(string $currency): string
    {
        $symbols = ['COP' => '$', 'USD' => 'US$', 'EUR' => '€', 'MXN' => '$', 'PEN' => 'S/', 'CLP' => '$'];
        $symbol = $symbols[strtoupper($currency)] ?? strtoupper($currency).' ';

        return '"'.$symbol.'"#,##0.00';
    }

    /**
     * Excel no admite : \ / ? * [ ] en el nombre, lo corta en 31 caracteres y no deja
     * dos hojas iguales; se resuelve aqui para que quien exporta no tenga que pensarlo.
     */
    protected function uniqueSheetName(string $name): string
    {
        $clean = trim(str_replace([':', '\\', '/', '?', '*', '[', ']'], '-', $name));
        $clean = $clean === '' ? 'Hoja' : mb_substr($clean, 0, 31);

        $used = array_map(fn (XlsxSheet $sheet) => mb_strtolower($sheet->name), $this->sheets);
        $candidate = $clean;
        $n = 1;

        while (in_array(mb_strtolower($candidate), $used, true)) {
            $n++;
            $suffix = ' ('.$n.')';
            $candidate = mb_substr($clean, 0, 31 - mb_strlen($suffix)).$suffix;
        }

        return $candidate;
    }
}
