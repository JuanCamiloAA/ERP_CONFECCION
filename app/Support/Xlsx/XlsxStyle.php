<?php

namespace App\Support\Xlsx;

/**
 * Indices del catalogo fijo de estilos que escribe XlsxWorkbook::stylesXml().
 *
 * Se mantiene a proposito corto: el generador no pretende cubrir Excel entero, solo lo
 * que necesitan los documentos que exporta el ERP (titulo, etiqueta, caja, dinero,
 * numero, porcentaje y cabecera de tabla).
 */
final class XlsxStyle
{
    public const DEFAULT = 0;

    public const BOLD = 1;

    /** Titulo de la hoja. */
    public const TITLE = 2;

    /** Texto gris de apoyo. */
    public const MUTED = 3;

    /** Cabecera de tabla: blanco sobre fondo oscuro. */
    public const HEAD = 4;

    /** Etiqueta de un dato (columna izquierda de las fichas). */
    public const LABEL = 5;

    /** Valor de texto dentro de caja. */
    public const BOX = 6;

    /** Valor monetario. */
    public const MONEY = 7;

    /** Valor monetario de un total (resaltado). */
    public const MONEY_TOTAL = 8;

    /** Entero con separador de miles. */
    public const INTEGER = 9;

    /** Decimal con un digito (minutos). */
    public const DECIMAL = 10;

    /** Porcentaje; el valor se escribe como fraccion (0.25 = 25%). */
    public const PERCENT = 11;

    /** Titulo de seccion dentro de la hoja. */
    public const SECTION = 12;

    /** Texto largo con ajuste de linea, sin borde. */
    public const WRAP = 13;

    /** Entero resaltado (fila de totales). */
    public const INTEGER_TOTAL = 14;

    /** Texto resaltado (fila de totales). */
    public const BOX_TOTAL = 15;

    /**
     * Porcentaje con un decimal y signo (+4,2% / -4,2%).
     *
     * Aparte de PERCENT porque las variaciones no se pueden redondear a entero —«+0%» y
     * «+0,4%» dicen cosas distintas— ni pueden perder el signo. El valor se escribe como
     * fraccion, igual que en PERCENT.
     */
    public const PERCENT_ONE = 16;

    /** El mismo porcentaje, resaltado (fila de totales). */
    public const PERCENT_ONE_TOTAL = 17;
}
