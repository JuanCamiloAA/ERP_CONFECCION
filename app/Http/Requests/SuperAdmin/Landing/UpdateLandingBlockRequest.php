<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Valida el contenido de un bloque contra el esquema de config/landing_blocks.php.
 *
 * No hay reglas escritas a mano por tipo: se recorre el esquema del tipo del bloque,
 * de modo que agregar un campo al catalogo lo deja validado automaticamente.
 */
class UpdateLandingBlockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('landing.manage') || ($this->user()?->isSuperAdmin() ?? false);
    }

    public function rules(): array
    {
        return [
            'data' => ['required', 'array'],
            'is_visible' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $block = $this->route('block');
            $schema = config('landing_blocks.'.$block->type.'.fields');

            if (! is_array($schema)) {
                $validator->errors()->add('data', 'Tipo de bloque desconocido.');

                return;
            }

            $this->validateFields($schema, (array) $this->input('data', []), 'data', $validator);
        });
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $values
     */
    private function validateFields(array $schema, array $values, string $path, Validator $validator): void
    {
        foreach ($schema as $key => $field) {
            $value = $values[$key] ?? null;
            $childPath = $path.'.'.$key;
            $type = $field['type'] ?? 'text';

            if ($value === null) {
                continue;
            }

            match ($type) {
                'text', 'textarea' => $this->validateText($value, $field, $childPath, $validator),
                'icon' => $this->validateIcon($value, $childPath, $validator),
                'image' => $this->validateImage($value, $childPath, $validator),
                'link' => $this->validateLink($value, $childPath, $validator),
                'repeater' => $this->validateRepeater($value, $field, $childPath, $validator),
                default => null,
            };
        }
    }

    private function validateText(mixed $value, array $field, string $path, Validator $validator): void
    {
        if (! is_string($value)) {
            $validator->errors()->add($path, 'Debe ser texto.');

            return;
        }

        $max = $field['max'] ?? null;
        if ($max !== null && mb_strlen($value) > (int) $max) {
            $validator->errors()->add($path, 'Máximo '.$max.' caracteres.');
        }
    }

    private function validateIcon(mixed $value, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        if (! is_string($value) || ! in_array($value, (array) config('landing_icons', []), true)) {
            $validator->errors()->add($path, 'Ícono no permitido.');
        }
    }

    private function validateImage(mixed $value, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        if (! is_string($value) || mb_strlen($value) > 400) {
            $validator->errors()->add($path, 'Ruta de imagen inválida.');
        }
    }

    private function validateLink(mixed $value, string $path, Validator $validator): void
    {
        if (! is_array($value)) {
            $validator->errors()->add($path, 'Enlace inválido.');

            return;
        }

        $label = $value['label'] ?? '';
        if (is_string($label) && mb_strlen($label) > 60) {
            $validator->errors()->add($path.'.label', 'Máximo 60 caracteres.');
        }

        $url = $value['url'] ?? '';
        if ($url !== '' && ! $this->isAcceptableUrl($url)) {
            $validator->errors()->add($path.'.url', 'Destino inválido: usa una URL o una ruta interna (/…, #…).');
        }
    }

    /** Se admiten URLs absolutas, rutas internas y anclas de la propia landing. */
    private function isAcceptableUrl(mixed $url): bool
    {
        if (! is_string($url) || mb_strlen($url) > 300) {
            return false;
        }

        return str_starts_with($url, '/')
            || str_starts_with($url, '#')
            || filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    private function validateRepeater(mixed $value, array $field, string $path, Validator $validator): void
    {
        if (! is_array($value)) {
            $validator->errors()->add($path, 'Debe ser una lista.');

            return;
        }

        $max = $field['max_items'] ?? null;
        if ($max !== null && count($value) > (int) $max) {
            $validator->errors()->add($path, 'Máximo '.$max.' elementos.');
        }

        foreach ($value as $i => $item) {
            if (! is_array($item)) {
                $validator->errors()->add($path.'.'.$i, 'Elemento inválido.');

                continue;
            }

            $this->validateFields($field['item'] ?? [], $item, $path.'.'.$i, $validator);
        }
    }
}
