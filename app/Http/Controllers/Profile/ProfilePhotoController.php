<?php

namespace App\Http\Controllers\Profile;

use App\Contracts\ObjectStorageInterface;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Scopes\CompanyScope;
use App\Services\Files\StoredFileDeleter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Foto de la cuenta.
 *
 * Va por su propia ruta y no dentro del guardado de identidad porque es el único campo que
 * obliga a enviar el formulario como multipart: mezclarlo haría que cada cambio de nombre
 * viajara como subida de archivo.
 *
 * Si la cuenta está vinculada a una ficha de empleado, la foto se propaga a la ficha: son
 * la misma persona y ver dos caras distintas en dos pantallas del mismo sistema es un
 * error que ya se había corregido en el módulo de empleados.
 */
class ProfilePhotoController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            // `max` va en kilobytes: 2048 = 2 MB, el límite que anuncia la pantalla.
            'photo' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:2048'],
        ], [
            'photo.required' => 'Elige una imagen.',
            'photo.image' => 'El archivo no es una imagen.',
            'photo.mimes' => 'La foto debe ser JPG o PNG.',
            'photo.max' => 'La foto no puede pesar más de 2 MB.',
        ]);

        $user = $request->user();

        $this->storedFileDeleter->deleteIfPresent($user->getAttributes()['avatar'] ?? null);

        $uploaded = $this->objectStorage->upload(
            $request->file('photo'),
            $user->company_id
                ? "companies/{$user->company_id}/users/{$user->id}/avatars"
                : "misc/users/{$user->id}/avatars",
        );

        $user->forceFill(['avatar' => $uploaded['path']])->save();

        $this->syncEmployeePhoto($user, $uploaded['path']);

        return back()->with('success', 'Foto actualizada.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        $this->storedFileDeleter->deleteIfPresent($user->getAttributes()['avatar'] ?? null);
        $user->forceFill(['avatar' => null])->save();

        $this->syncEmployeePhoto($user, null);

        return back()->with('success', 'Foto eliminada.');
    }

    protected function syncEmployeePhoto($user, ?string $path): void
    {
        if (! $user->employee_id) {
            return;
        }

        $employee = Employee::withoutGlobalScope(CompanyScope::class)->find($user->employee_id);

        if (! $employee) {
            return;
        }

        // La foto anterior de la ficha se borra solo si era otra: cuando ya apunta al mismo
        // archivo que el avatar, borrarla dejaría las dos pantallas sin imagen.
        $current = $employee->getAttributes()['photo'] ?? null;
        if ($current !== null && $current !== $path) {
            $this->storedFileDeleter->deleteIfPresent($current);
        }

        $employee->forceFill(['photo' => $path])->save();
    }
}
