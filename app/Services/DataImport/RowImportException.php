<?php

namespace App\Services\DataImport;

use RuntimeException;

class RowImportException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $lineNumber = 0,
    ) {
        parent::__construct($message);
    }
}
