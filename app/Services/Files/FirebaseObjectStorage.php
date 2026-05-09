<?php

namespace App\Services\Files;

use App\Contracts\ObjectStorageInterface;
use Illuminate\Http\UploadedFile;

class FirebaseObjectStorage implements ObjectStorageInterface
{
    public function __construct(
        protected FirebaseStorageService $firebase,
    ) {}

    public function upload(UploadedFile $file, string $directory): array
    {
        $result = $this->firebase->upload($file, trim($directory, '/'));

        return [
            'path' => 'firebase:'.$result['path'],
            'url' => $result['url'],
        ];
    }
}
