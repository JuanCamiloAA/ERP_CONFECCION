<?php

namespace App\Contracts;

use Illuminate\Http\UploadedFile;

interface ObjectStorageInterface
{
    /**
     * @return array{path: string, url: string} path = valor persistible en BD; url = URL publica de lectura
     */
    public function upload(UploadedFile $file, string $directory): array;
}
