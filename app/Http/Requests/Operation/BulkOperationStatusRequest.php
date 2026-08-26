<?php

namespace App\Http\Requests\Operation;

use App\Models\Operation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Activar o inactivar varias operaciones de una vez.
 *
 * La pertenencia a la empresa no se da por sentada: los ids llegan del navegador y el
 * `exists` de la regla no sabe de inquilinos. Se comprueban contra el scope de empresa,
 * que es el que ya filtra todo lo que el usuario puede ver.
 */
class BulkOperationStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('operations.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $ids = collect($this->input('ids', []))->map(fn ($id) => (int) $id)->filter()->unique();

            if ($ids->isEmpty()) {
                return;
            }

            // Operation lleva el scope de empresa: lo que no sea suyo no aparece aqui.
            $visibles = Operation::query()->whereIn('id', $ids)->pluck('id');

            if ($visibles->count() !== $ids->count()) {
                $validator->errors()->add('ids', 'Alguna de las operaciones seleccionadas ya no esta disponible.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'ids.required' => 'Selecciona al menos una operacion.',
        ];
    }
}
