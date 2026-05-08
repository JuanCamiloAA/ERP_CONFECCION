<?php

namespace App\Services\DataImport;

interface ImportStrategyInterface
{
    /**
     * Procesa una fila ya asociativa (claves de cabecera CSV).
     *
     * @param  array<string, string|null>  $row
     *
     * @throws RowImportException
     */
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void;
}
