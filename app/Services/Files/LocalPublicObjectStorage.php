<?php

namespace App\Services\Files;

use App\Contracts\ObjectStorageInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LocalPublicObjectStorage implements ObjectStorageInterface
{
    public function upload(UploadedFile $file, string $directory): array
    {
        $directory = trim($directory, '/');
        $ext = strtolower($file->getClientOriginalExtension()) ?: 'bin';
        $filename = Str::uuid()->toString().'.'.$ext;
        $path = $file->storeAs($directory, $filename, 'public');

        return [
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ];
    }
}
