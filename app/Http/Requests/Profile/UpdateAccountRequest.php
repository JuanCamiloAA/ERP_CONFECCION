<?php

namespace App\Http\Requests\Profile;

use App\Support\NotificationPreferences;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Guardado de «Mi perfil»: identidad y preferencias, nada más.
 *
 * El correo, la contraseña, el rol y el estado de la cuenta NO están aquí ni por
 * casualidad: cada uno tiene su propio camino con reautenticación o con permiso. Si
 * cupieran en este request, bastaría con añadir un campo al formulario del navegador para
 * cambiarse el rol —la validación es lo único que lo impide.
 */
class UpdateAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        // Las casillas llegan como "1"/"0"/"true" según el navegador y el tipo de envío.
        $preferences = $this->input('preferences');

        if (is_array($preferences)) {
            $this->merge([
                'preferences' => array_map(
                    fn ($value) => filter_var($value, FILTER_VALIDATE_BOOLEAN),
                    $preferences,
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            // Formato laxo a propósito: se usan fijos, celulares y extensiones, y una
            // expresión estricta rechazaría números válidos del país equivocado.
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'job_title' => ['nullable', 'string', 'max:120'],
            // Las claves desconocidas no se rechazan con un error —no son culpa de quien
            // usa la pantalla—: simplemente `NotificationPreferences::normalize()` las
            // descarta al guardar, así que nunca llegan al json.
            'preferences' => ['nullable', 'array'],
            'preferences.*' => ['boolean'],
        ];
    }

    /**
     * Preferencias listas para guardar, ya acotadas al catálogo.
     *
     * @return array<string, bool>
     */
    public function preferences(): array
    {
        return NotificationPreferences::normalize($this->validated('preferences') ?? []);
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio.',
            'phone.regex' => 'El teléfono solo admite dígitos, espacios y los signos + ( ) -.',
        ];
    }
}
