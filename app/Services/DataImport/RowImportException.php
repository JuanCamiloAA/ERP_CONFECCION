<?php

namespace App\Services\DataImport;

use RuntimeException;

/**
 * Una fila del CSV que no se pudo importar.
 *
 * `field` y `value` son opcionales y sirven para que el detalle del lote diga que celda
 * fallo y con que dato, en vez de solo el motivo. Los reportes guardados antes de que
 * existieran no los traen, asi que quien los lea debe tratarlos como ausentes.
 */
class RowImportException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $lineNumber = 0,
        public readonly ?string $field = null,
        public readonly mixed $value = null,
    ) {
        parent::__construct($message);
    }
}
