<?php

namespace App\Support;

use App\Models\DataImportBatch;
use Illuminate\Support\Facades\Storage;

final class DataImportStorage
{
    public static function diskName(): string
    {
        return (string) config('data_import.disk', 'imports');
    }

    public static function storeUploadedCsv($file, string $filename): string
    {
        $disk = self::diskName();
        $file->storeAs('', $filename, $disk);

        return $filename;
    }

    /**
     * Ruta absoluta legible del CSV, con compatibilidad para lotes guardados en rutas antiguas.
     */
    public static function absolutePath(DataImportBatch $batch): ?string
    {
        $disk = Storage::disk(self::diskName());
        $stored = ltrim((string) $batch->stored_path, '/');

        if ($stored !== '' && $disk->exists($stored)) {
            return $disk->path($stored);
        }

        $basename = basename($stored);
        if ($basename !== '' && $disk->exists($basename)) {
            return $disk->path($basename);
        }

        $legacyCandidates = [
            storage_path('app/'.$stored),
            storage_path('app/public/'.$stored),
            storage_path('app/private/'.$stored),
            storage_path('app/imports/'.$basename),
            storage_path('app/public/imports/'.$basename),
            storage_path('app/private/imports/'.$basename),
        ];

        foreach ($legacyCandidates as $candidate) {
            if ($candidate !== '' && is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
