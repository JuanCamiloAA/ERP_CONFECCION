<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use App\Services\Landing\LandingDataSources;
use App\Services\Landing\SafeQueryRunner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use RuntimeException;

/**
 * Valida el contenido de un bloque contra el esquema de config/landing_blocks.php y su
 * apariencia contra config/landing_appearance.php.
 *
 * No hay reglas escritas a mano por tipo: se recorre el esquema del tipo del bloque,
 * de modo que agregar un campo a cualquiera de los dos catalogos lo deja validado
 * automaticamente.
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

            $data = (array) $this->input('data', []);

            $this->validateFields($schema, $data, 'data', $validator);
            $this->validateAppearance($block->type, $data['appearance'] ?? null, $validator);
        });
    }

    /**
     * La apariencia (tamano, fondo y animacion) es comun a todos los tipos y se guarda
     * dentro de `data.appearance`. Los bloques marcados con `appearance => false` en el
     * catalogo dibujan su propio marco y no admiten estos ajustes.
     */
    private function validateAppearance(string $type, mixed $value, Validator $validator): void
    {
        if ($value === null || $value === '' || $value === []) {
            return;
        }

        if (config("landing_blocks.$type.appearance") === false) {
            $validator->errors()->add('data.appearance', 'Este bloque no admite ajustes de apariencia.');

            return;
        }

        if (! is_array($value)) {
            $validator->errors()->add('data.appearance', 'Apariencia invalida.');

            return;
        }

        foreach (config('landing_appearance', []) as $group) {
            $this->validateFields($group['fields'] ?? [], $value, 'data.appearance', $validator);
        }
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
                'select' => $this->validateSelect($value, $field, $childPath, $validator),
                'multiselect' => $this->validateMultiselect($value, $field, $childPath, $validator),
                'sql' => $this->validateSql($value, $field, $childPath, $validator),
                'color' => $this->validateColor($value, $childPath, $validator),
                'range' => $this->validateRange($value, $field, $childPath, $validator),
                'toggle' => $this->validateToggle($value, $childPath, $validator),
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

    /**
     * Solo se admite un valor que este entre las opciones ofrecidas: ni el catalogo fijo
     * ni las listas del servidor se pueden esquivar mandando otra cosa.
     *
     * @return list<string>
     */
    private function allowedValues(array $field): array
    {
        if (isset($field['options']) && is_array($field['options'])) {
            return array_map(fn ($o) => (string) ($o['value'] ?? ''), $field['options']);
        }

        $from = $field['options_from'] ?? null;
        if (! is_string($from)) {
            return [];
        }

        $options = app(LandingDataSources::class)->editorOptions()[$from] ?? [];

        return array_map(fn ($o) => (string) ($o['value'] ?? ''), $options);
    }

    private function validateSelect(mixed $value, array $field, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        if (! is_scalar($value) || ! in_array((string) $value, $this->allowedValues($field), true)) {
            $validator->errors()->add($path, 'Opción no válida.');
        }
    }

    private function validateMultiselect(mixed $value, array $field, string $path, Validator $validator): void
    {
        if (! is_array($value)) {
            $validator->errors()->add($path, 'Debe ser una lista.');

            return;
        }

        $allowed = $this->allowedValues($field);

        foreach ($value as $i => $item) {
            if (! is_scalar($item) || ! in_array((string) $item, $allowed, true)) {
                $validator->errors()->add($path.'.'.$i, 'Opción no válida.');
            }
        }
    }

    /**
     * La consulta se valida con los mismos candados con que se ejecutara, para que el
     * super usuario vea el motivo al guardar y no al publicar.
     */
    private function validateSql(mixed $value, array $field, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        if (! is_string($value)) {
            $validator->errors()->add($path, 'Debe ser texto.');

            return;
        }

        $max = $field['max'] ?? 1000;
        if (mb_strlen($value) > (int) $max) {
            $validator->errors()->add($path, 'Máximo '.$max.' caracteres.');

            return;
        }

        try {
            app(SafeQueryRunner::class)->guard($value);
        } catch (RuntimeException $e) {
            $validator->errors()->add($path, $e->getMessage());
        }
    }

    /** Un token del lenguaje publico (bg, surface, band...) o un color hexadecimal. */
    private function validateColor(mixed $value, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        $tokens = ['bg', 'surface', 'band', 'accent_fill', 'accent', 'black'];

        if (! is_string($value) || (! in_array($value, $tokens, true) && ! preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value))) {
            $validator->errors()->add($path, 'Color invalido: usa uno de la paleta o un hexadecimal (#1a1a2e).');
        }
    }

    private function validateRange(mixed $value, array $field, string $path, Validator $validator): void
    {
        if ($value === '' || $value === null) {
            return;
        }

        if (! is_numeric($value)) {
            $validator->errors()->add($path, 'Debe ser un numero.');

            return;
        }

        $min = (float) ($field['min'] ?? 0);
        $max = (float) ($field['max'] ?? 100);

        if ((float) $value < $min || (float) $value > $max) {
            $validator->errors()->add($path, "Debe estar entre $min y $max.");
        }
    }

    private function validateToggle(mixed $value, string $path, Validator $validator): void
    {
        if (! is_bool($value)) {
            $validator->errors()->add($path, 'Debe ser si o no.');
        }
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
