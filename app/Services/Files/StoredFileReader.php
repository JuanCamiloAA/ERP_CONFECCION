<?php

namespace App\Services\Files;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Lee el contenido de un archivo guardado, venga de donde venga.
 *
 * Espejo de StoredFileDeleter: entiende los mismos tres formatos del valor persistido
 * (`firebase:objeto`, URL absoluta y ruta del disco publico). Se usa para meter la
 * imagen DENTRO del Excel exportado; en pantalla basta la URL, pero un archivo que se
 * envia por correo tiene que viajar con la foto adentro.
 *
 * Nunca lanza: si el archivo no esta o el bucket no responde, el documento sale sin
 * imagen antes que fallar la descarga entera.
 */
class StoredFileReader
{
    public function __construct(
        protected FirebaseStorageService $firebase,
    ) {}

    public function contents(?string $stored): ?string
    {
        if ($stored === null || $stored === '') {
            return null;
        }

        $stored = trim($stored);

        try {
            if (str_starts_with($stored, 'firebase:')) {
                return $this->firebase->downloadContents(substr($stored, strlen('firebase:')));
            }

            if (str_starts_with($stored, 'http://') || str_starts_with($stored, 'https://')) {
                $response = Http::timeout(15)->get($stored);

                return $response->successful() ? $response->body() : null;
            }

            $disk = Storage::disk('public');
            $path = ltrim($stored, '/');

            return $disk->exists($path) ? $disk->get($path) : null;
        } catch (Throwable $e) {
            Log::warning('No se pudo leer un archivo almacenado', [
                'stored' => $stored,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
