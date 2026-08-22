<?php

namespace App\Support\Xlsx;

/**
 * Una celda del generador XLSX: valor, estilo y tipo.
 *
 * Las filas tambien aceptan escalares sueltos (texto o numero con estilo por defecto);
 * esta clase es para cuando hay que decir con que estilo se pinta.
 */
final class XlsxCell
{
    private function __construct(
        public readonly mixed $value,
        public readonly int $style,
        /** "s" = cadena en linea, "n" = numero, "b" = vacia */
        public readonly string $type,
    ) {}

    public static function text(?string $value, int $style = XlsxStyle::DEFAULT): self
    {
        return new self($value, $style, $value === null || $value === '' ? 'b' : 's');
    }

    public static function number(int|float|string|null $value, int $style = XlsxStyle::DEFAULT): self
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return new self(null, $style, 'b');
        }

        return new self(0 + $value, $style, 'n');
    }

    /** Celda sin contenido, util para que el borde de una tabla no se corte. */
    public static function empty(int $style = XlsxStyle::DEFAULT): self
    {
        return new self(null, $style, 'b');
    }

    /** Convierte un escalar suelto en celda con el estilo indicado. */
    public static function from(mixed $value, int $style = XlsxStyle::DEFAULT): self
    {
        if ($value instanceof self) {
            return $value;
        }

        if (is_bool($value)) {
            return self::text($value ? 'Si' : 'No', $style);
        }

        if (is_int($value) || is_float($value)) {
            return self::number($value, $style);
        }

        return self::text($value === null ? null : (string) $value, $style);
    }
}
