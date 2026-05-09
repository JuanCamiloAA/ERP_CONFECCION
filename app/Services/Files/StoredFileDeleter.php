<?php

namespace App\Services\Files;

use Illuminate\Support\Facades\Storage;

class StoredFileDeleter
{
    public function __construct(
        protected FirebaseStorageService $firebase,
    ) {}

    public function deleteIfPresent(?string $stored): void
    {
        if ($stored === null || $stored === '') {
            return;
        }

        $stored = trim($stored);

        if (str_starts_with($stored, 'http://') || str_starts_with($stored, 'https://')) {
            return;
        }

        if (str_starts_with($stored, 'firebase:')) {
            $this->firebase->delete(substr($stored, strlen('firebase:')));

            return;
        }

        Storage::disk('public')->delete(ltrim($stored, '/'));
    }
}
