<?php

namespace App\Services\Files;

use Illuminate\Support\Facades\Storage;

class MediaUrlResolver
{
    public function __construct(
        protected FirebaseStorageService $firebase,
    ) {}

    public function url(?string $stored): ?string
    {
        if ($stored === null || $stored === '') {
            return null;
        }

        $stored = trim($stored);

        if (str_starts_with($stored, 'http://') || str_starts_with($stored, 'https://')) {
            return $stored;
        }

        if (str_starts_with($stored, 'firebase:')) {
            $objectPath = substr($stored, strlen('firebase:'));

            return $this->firebase->readableUrl($objectPath);
        }

        return Storage::disk('public')->url(ltrim($stored, '/'));
    }
}
