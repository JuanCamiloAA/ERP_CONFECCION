<?php

namespace App\Support\Xlsx;

/**
 * Imagen lista para anclar en una hoja.
 *
 * Excel solo dibuja los formatos de mapa de bits clasicos, y el servidor no tiene GD ni
 * Imagick para convertir; por eso el tipo se deduce leyendo los primeros bytes y no la
 * extension del archivo, y de ahi sale tambien el tamano en pixeles para respetar la
 * proporcion al anclarla.
 */
final class XlsxImage
{
    private function __construct(
        public readonly string $data,
        public readonly string $extension,
        public readonly int $width,
        public readonly int $height,
    ) {}

    /**
     * Devuelve null cuando el binario no es un formato que Excel sepa dibujar
     * (webp, svg, avif...), para que la exportacion siga sin la imagen.
     */
    public static function fromBinary(?string $data): ?self
    {
        if ($data === null || strlen($data) < 24) {
            return null;
        }

        foreach ([[self::class, 'png'], [self::class, 'jpeg'], [self::class, 'gif']] as $reader) {
            $info = $reader($data);
            if ($info !== null) {
                return new self($data, $info[0], $info[1], $info[2]);
            }
        }

        return null;
    }

    /**
     * @return array{0: string, 1: int, 2: int}|null
     */
    private static function png(string $d): ?array
    {
        if (substr($d, 0, 8) !== "\x89PNG\r\n\x1a\n" || substr($d, 12, 4) !== 'IHDR') {
            return null;
        }

        $w = unpack('N', substr($d, 16, 4))[1] ?? 0;
        $h = unpack('N', substr($d, 20, 4))[1] ?? 0;

        return $w > 0 && $h > 0 ? ['png', (int) $w, (int) $h] : null;
    }

    /**
     * @return array{0: string, 1: int, 2: int}|null
     */
    private static function jpeg(string $d): ?array
    {
        if (substr($d, 0, 2) !== "\xFF\xD8") {
            return null;
        }

        $len = strlen($d);
        $i = 2;

        while ($i < $len - 9) {
            if ($d[$i] !== "\xFF") {
                $i++;

                continue;
            }

            $marker = ord($d[$i + 1]);
            $i += 2;

            // Marcadores sin carga util (rellenos, RSTn, SOI/EOI).
            if ($marker === 0xD8 || $marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                continue;
            }

            if ($i + 1 >= $len) {
                break;
            }

            $size = unpack('n', substr($d, $i, 2))[1] ?? 0;

            // SOF0..SOF15 salvo DHT (C4), JPG (C8) y DAC (CC): ahi viven alto y ancho.
            if ($marker >= 0xC0 && $marker <= 0xCF && ! in_array($marker, [0xC4, 0xC8, 0xCC], true)) {
                $h = unpack('n', substr($d, $i + 3, 2))[1] ?? 0;
                $w = unpack('n', substr($d, $i + 5, 2))[1] ?? 0;

                return $w > 0 && $h > 0 ? ['jpeg', (int) $w, (int) $h] : null;
            }

            if ($size < 2) {
                break;
            }

            $i += $size;
        }

        return null;
    }

    /**
     * @return array{0: string, 1: int, 2: int}|null
     */
    private static function gif(string $d): ?array
    {
        if (substr($d, 0, 3) !== 'GIF') {
            return null;
        }

        $w = unpack('v', substr($d, 6, 2))[1] ?? 0;
        $h = unpack('v', substr($d, 8, 2))[1] ?? 0;

        return $w > 0 && $h > 0 ? ['gif', (int) $w, (int) $h] : null;
    }

    /**
     * Tamano de dibujo en pixeles que cabe en la caja dada sin deformar la imagen.
     *
     * @return array{0: int, 1: int}
     */
    public function fitInside(int $maxWidth, int $maxHeight): array
    {
        $factor = min($maxWidth / $this->width, $maxHeight / $this->height, 1.0);

        return [max(1, (int) round($this->width * $factor)), max(1, (int) round($this->height * $factor))];
    }
}
