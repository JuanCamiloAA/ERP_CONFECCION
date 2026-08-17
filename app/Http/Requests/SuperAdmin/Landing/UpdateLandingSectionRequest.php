<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use App\Support\LandingIcons;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateLandingSectionRequest extends FormRequest
{
    /** Tope de longitud para cualquier texto del contenido editable. */
    private const MAX_TEXT = 2000;

    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'draft_payload' => ['required', 'array'],
        ];
    }

    /**
     * El payload es libre por tipo de bloque, asi que en vez de declarar cada campo se
     * recorre el arbol: los textos no pueden exceder el tope y todo campo "icon" debe
     * estar en la lista blanca de Phosphor (si no, el render quedaria sin icono).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $payload = $this->input('draft_payload');
            if (! is_array($payload)) {
                return;
            }

            $this->walk($payload, 'draft_payload', $validator);
        });
    }

    private function walk(array $node, string $path, Validator $validator): void
    {
        foreach ($node as $key => $value) {
            $childPath = $path.'.'.$key;

            if (is_array($value)) {
                $this->walk($value, $childPath, $validator);

                continue;
            }

            if (is_string($value)) {
                if (mb_strlen($value) > self::MAX_TEXT) {
                    $validator->errors()->add($childPath, 'El texto supera los '.self::MAX_TEXT.' caracteres.');
                }

                if ($key === 'icon' && $value !== '' && ! LandingIcons::isAllowed($value)) {
                    $validator->errors()->add($childPath, 'Ícono no permitido.');
                }
            }
        }
    }
}
