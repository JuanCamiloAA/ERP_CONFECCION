<?php

namespace App\Services\Files;

use DateTimeImmutable;
use DateTimeZone;
use Google\Cloud\Core\Exception\NotFoundException;
use Google\Cloud\Storage\StorageClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class FirebaseStorageService
{
    protected ?StorageClient $client = null;

    public function upload(UploadedFile $file, string $directory): array
    {
        $directory = trim($directory, '/');
        $ext = $this->resolveExtension($file);
        $allowed = config('firebase.allowed_extensions', ['jpg', 'jpeg', 'png', 'webp', 'pdf']);

        if (! in_array($ext, $allowed, true)) {
            throw new RuntimeException('Tipo de archivo no permitido.');
        }

        $objectName = $directory.'/'.Str::uuid()->toString().'.'.$ext;
        $bucketName = config('firebase.storage_bucket');

        if (! is_string($bucketName) || $bucketName === '') {
            throw new RuntimeException('FIREBASE_STORAGE_BUCKET no esta configurado.');
        }

        $bucket = $this->client()->bucket($bucketName);
        $realPath = $file->getRealPath();
        if ($realPath === false) {
            throw new RuntimeException('No se pudo leer el archivo subido.');
        }

        $handle = fopen($realPath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('No se pudo leer el archivo subido.');
        }

        try {
            $bucket->upload($handle, [
                'name' => $objectName,
                'metadata' => [
                    'contentType' => $file->getMimeType() ?: 'application/octet-stream',
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Firebase Storage upload fallido', [
                'object' => $objectName,
                'bucket' => $bucketName,
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException($this->humanUploadErrorMessage($e), 0, $e);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }

        return [
            'path' => $objectName,
            'url' => $this->readableUrl($objectName),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ];
    }

    public function uploadFromPath(string $absolutePath, string $remotePath): array
    {
        if (! is_readable($absolutePath)) {
            throw new RuntimeException('Archivo de origen no legible.');
        }

        $remotePath = trim($remotePath, '/');
        $bucketName = config('firebase.storage_bucket');

        if (! is_string($bucketName) || $bucketName === '') {
            throw new RuntimeException('FIREBASE_STORAGE_BUCKET no esta configurado.');
        }

        $bucket = $this->client()->bucket($bucketName);
        $handle = fopen($absolutePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('No se pudo leer el archivo.');
        }

        try {
            $bucket->upload($handle, [
                'name' => $remotePath,
                'metadata' => [
                    'contentType' => $this->guessContentType($remotePath),
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Firebase Storage uploadFromPath fallido', [
                'object' => $remotePath,
                'bucket' => $bucketName,
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException($this->humanUploadErrorMessage($e), 0, $e);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }

        return [
            'path' => $remotePath,
            'url' => $this->readableUrl($remotePath),
        ];
    }

    public function delete(string $objectPath): bool
    {
        $objectPath = trim($objectPath, '/');
        $bucketName = config('firebase.storage_bucket');

        if (! is_string($bucketName) || $bucketName === '' || $objectPath === '') {
            return false;
        }

        try {
            $this->client()->bucket($bucketName)->object($objectPath)->delete();

            return true;
        } catch (Throwable $e) {
            Log::warning('Firebase Storage delete fallido', [
                'object' => $objectPath,
                'message' => $e->getMessage(),
            ]);
        }

        return false;
    }

    public function downloadContents(string $objectPath): string
    {
        $objectPath = trim($objectPath, '/');
        $bucketName = config('firebase.storage_bucket');

        if (! is_string($bucketName) || $bucketName === '' || $objectPath === '') {
            throw new RuntimeException('Ruta de objeto Firebase invalida.');
        }

        try {
            $object = $this->client()->bucket($bucketName)->object($objectPath);

            return $object->downloadAsString();
        } catch (Throwable $e) {
            Log::error('Firebase Storage download fallido', [
                'object' => $objectPath,
                'bucket' => $bucketName,
                'message' => $e->getMessage(),
            ]);

            throw new RuntimeException('No se pudo leer el archivo desde Firebase Storage.', 0, $e);
        }
    }

    public function readableUrl(string $objectPath): string
    {
        $objectPath = trim($objectPath, '/');
        $bucketName = config('firebase.storage_bucket');

        if (! is_string($bucketName) || $bucketName === '' || $objectPath === '') {
            return '';
        }

        try {
            $object = $this->client()->bucket($bucketName)->object($objectPath);
            $days = (int) config('firebase.signed_url_ttl_days', 7);
            $expires = new DateTimeImmutable("+{$days} days", new DateTimeZone('UTC'));

            return $object->signedUrl($expires, ['version' => 'v4']);
        } catch (Throwable $e) {
            Log::warning('Firebase readableUrl (firmada) fallida', [
                'object' => $objectPath,
                'message' => $e->getMessage(),
            ]);

            return $this->publicUrl($objectPath);
        }
    }

    public function publicUrl(string $objectPath): string
    {
        $objectPath = trim($objectPath, '/');
        $bucket = config('firebase.storage_bucket');

        if (! is_string($bucket) || $bucket === '' || $objectPath === '') {
            return '';
        }

        $encoded = rawurlencode($objectPath);

        return 'https://firebasestorage.googleapis.com/v0/b/'.$bucket.'/o/'.$encoded.'?alt=media';
    }

    protected function client(): StorageClient
    {
        if ($this->client instanceof StorageClient) {
            return $this->client;
        }

        $projectId = config('firebase.project_id');

        if (! is_string($projectId) || $projectId === '') {
            throw new RuntimeException('FIREBASE_PROJECT_ID no esta configurado.');
        }

        $config = ['projectId' => $projectId];

        $path = config('firebase.credentials_path');
        if (is_string($path) && $path !== '' && is_readable($path)) {
            $config['keyFilePath'] = $path;
        } else {
            $json = config('firebase.credentials_json');
            if (is_string($json) && $json !== '') {
                $decoded = json_decode($json, true);
                if (is_array($decoded)) {
                    $config['keyFile'] = $decoded;
                }
            }
        }

        if (! isset($config['keyFilePath']) && ! isset($config['keyFile'])) {
            throw new RuntimeException(
                'Credenciales Firebase no configuradas (GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_CREDENTIALS_JSON).'
            );
        }

        $this->client = new StorageClient($config);

        return $this->client;
    }

    protected function humanUploadErrorMessage(Throwable $e): string
    {
        $msg = $e->getMessage();
        $isBucketMissing = $e instanceof NotFoundException
            || str_contains($msg, 'The specified bucket does not exist')
            || str_contains($msg, 'bucket does not exist');

        if ($isBucketMissing) {
            return 'El bucket de Firebase no existe o FIREBASE_STORAGE_BUCKET no coincide con el ID real. '
                .'En Firebase Console abra Storage, active el producto si aun no lo hizo, y copie el nombre del bucket '
                .'(suele ser {proyecto}.appspot.com o {proyecto}.firebasestorage.app). '
                .'Revise tambien que el bucket este en el mismo proyecto que la cuenta de servicio.';
        }

        return 'Error al subir el archivo. Intente de nuevo.';
    }

    protected function resolveExtension(UploadedFile $file): string
    {
        $ext = strtolower($file->getClientOriginalExtension());
        if ($ext !== '') {
            if ($ext === 'jpeg') {
                return 'jpg';
            }

            return $ext;
        }

        $mime = (string) ($file->getMimeType() ?? '');

        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'application/pdf' => 'pdf',
            'text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel' => 'csv',
            default => 'bin',
        };
    }

    protected function guessContentType(string $remotePath): string
    {
        $ext = strtolower(pathinfo($remotePath, PATHINFO_EXTENSION));

        return match ($ext) {
            'csv' => 'text/csv; charset=UTF-8',
            'pdf' => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'application/octet-stream',
        };
    }
}
