<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Nuevo orden de un catalogo: `[{id, sort_order}, ...]`.
 *
 * Lo comparten categorias de gasto y conceptos de nomina porque el contrato es el mismo;
 * quien lo recibe acota los ids a su empresa antes de escribir.
 */
class ReorderCatalogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order' => ['required', 'array', 'min:1', 'max:500'],
            'order.*.id' => ['required', 'integer'],
            'order.*.sort_order' => ['required', 'integer', 'min:0', 'max:999999'],
        ];
    }

    public function attributes(): array
    {
        return [
            'order' => 'orden',
        ];
    }
}
