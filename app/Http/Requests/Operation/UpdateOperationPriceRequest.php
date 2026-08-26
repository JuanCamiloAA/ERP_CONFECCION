<?php

namespace App\Http\Requests\Operation;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Cambio de precio desde el listado.
 *
 * Solo viaja `base_price`: es una edicion de un dato, no del formulario completo, y
 * exigir el resto obligaria a reenviar nombre, minutos y descripcion para corregir una
 * cifra —con todas sus validaciones de por medio—.
 */
class UpdateOperationPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('operations.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'base_price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'base_price.required' => 'Indica el precio base.',
            'base_price.numeric' => 'El precio debe ser un numero.',
            'base_price.min' => 'El precio no puede ser negativo.',
        ];
    }
}
