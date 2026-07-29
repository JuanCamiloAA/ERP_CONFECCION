<?php

namespace App\Support;

use App\Models\DataImportBatch;
use App\Services\Files\FirebaseStorageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

final class DataImportStorage
{
    public static function usesFirebase(): bool
    {
        return (string) config('filesystems.default_upload', 'local') === 'firebase';
    }

    public static function diskName(): string
    {
        return (string) config('data_import.disk', 'imports');
    }

    public static function storeUploadedCsv(UploadedFile $file, string $filename): string
    {
        $filename = ltrim($filename, '/');

        if (self::usesFirebase()) {
            $realPath = $file->getRealPath();
            if ($realPath === false || ! is_readable($realPath)) {
                throw new RuntimeException('No se pudo leer el CSV subido para enviarlo a Firebase.');
            }

            $objectPath = 'imports/'.$filename;
            $result = app(FirebaseStorageService::class)->uploadFromPath($realPath, $objectPath);

            return 'firebase:'.$result['path'];
        }

        $file->storeAs('', $filename, self::diskName());

        return $filename;
    }

    public static function readCsvContents(DataImportBatch $batch): ?string
    {
        $stored = trim((string) $batch->stored_path);
        if ($stored === '') {
            return null;
        }

        if (str_starts_with($stored, 'firebase:')) {
            return self::readFirebaseObject(substr($stored, strlen('firebase:')), $batch->id);
        }

        $path = self::absolutePath($batch);
        if ($path !== null) {
            $contents = file_get_contents($path);

            return $contents === false ? null : $contents;
        }

        if (self::usesFirebase()) {
            $basename = basename($stored);
            if ($basename !== '' && $basename === $stored) {
                return self::readFirebaseObject('imports/'.$basename, $batch->id);
            }
        }

        return null;
    }

    private static function readFirebaseObject(string $objectPath, ?int $batchId = null): ?string
    {
        try {
            return app(FirebaseStorageService::class)->downloadContents($objectPath);
        } catch (Throwable $e) {
            Log::warning('data_import_firebase_read_failed', [
                'batch_id' => $batchId,
                'object' => $objectPath,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Ruta absoluta legible del CSV en disco local (lotes legacy o driver local).
     */
    public static function absolutePath(DataImportBatch $batch): ?string
    {
        $stored = ltrim((string) $batch->stored_path, '/');

        if ($stored === '' || str_starts_with($stored, 'firebase:')) {
            return null;
        }

        $disk = Storage::disk(self::diskName());

        if ($disk->exists($stored)) {
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

    public static function deleteStoredFile(?string $stored): void
    {
        if ($stored === null || trim($stored) === '') {
            return;
        }

        $stored = trim($stored);

        if (str_starts_with($stored, 'firebase:')) {
            try {
                app(FirebaseStorageService::class)->delete(substr($stored, strlen('firebase:')));
            } catch (Throwable $e) {
                Log::warning('data_import_firebase_delete_failed', [
                    'stored' => $stored,
                    'message' => $e->getMessage(),
                ]);
            }

            return;
        }

        if (self::usesFirebase()) {
            $basename = basename($stored);
            if ($basename !== '' && $basename === ltrim($stored, '/')) {
                try {
                    app(FirebaseStorageService::class)->delete('imports/'.$basename);
                } catch (Throwable $e) {
                    Log::warning('data_import_firebase_delete_failed', [
                        'stored' => $stored,
                        'message' => $e->getMessage(),
                    ]);
                }
            }
        }

        $path = ltrim($stored, '/');
        $disk = Storage::disk(self::diskName());

        if ($disk->exists($path)) {
            $disk->delete($path);
        }
    }

    public static function deleteBatchArtifacts(DataImportBatch $batch): void
    {
        self::deleteStoredFile($batch->stored_path);

        $errorPath = $batch->error_report_path;
        if ($errorPath !== null && $errorPath !== '') {
            $disk = Storage::disk(self::diskName());
            if ($disk->exists($errorPath)) {
                $disk->delete($errorPath);
            }
        }
    }
}
