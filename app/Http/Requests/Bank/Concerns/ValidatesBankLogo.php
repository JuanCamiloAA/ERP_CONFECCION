<?php

namespace App\Http\Requests\Bank\Concerns;

use App\Models\Bank;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

/**
 * Reglas compartidas por crear y editar banco.
 *
 * El logo lo sube el cliente, no lo empaqueta la aplicacion, asi que la validacion es la
 * unica barrera: un SVG es un documento ejecutable y se sirve desde nuestro dominio.
 */
trait ValidatesBankLogo
{
    /** Ancho y alto minimos de un logo de mapa de bits, en pixeles. */
    protected const MIN_LOGO_SIDE = 128;

    /** @return array<string, array<int, mixed>> */
    protected function brandRules(): array
    {
        return [
            // `file` y no `image`: la regla `image` rechaza SVG porque no puede medirlo.
            'logo' => ['nullable', 'file', 'mimetypes:image/png,image/webp,image/svg+xml', 'max:512'],
            'logo_remove' => ['nullable', 'boolean'],
            'brand_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'type' => ['required', Rule::in(array_keys(Bank::TYPES))],
            'account_format' => ['nullable', 'string', 'max:40'],
            'account_hint' => ['nullable', 'string', 'max:120'],
            'requires_key' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    protected function brandMessages(): array
    {
        return [
            'logo.mimetypes' => 'El logo debe ser un archivo PNG, WEBP o SVG.',
            'logo.max' => 'El logo no puede pesar más de 512 KB.',
            'brand_color.regex' => 'El color de marca debe ir en formato hexadecimal, por ejemplo #1D4ED8.',
            'type.required' => 'Indica si es un banco, una billetera digital o una cooperativa.',
            'type.in' => 'El tipo de entidad no es válido.',
            'account_format.max' => 'El formato de cuenta no puede pasar de 40 caracteres.',
            'account_hint.max' => 'La ayuda del número de cuenta no puede pasar de 120 caracteres.',
            'notes.max' => 'Las notas no pueden pasar de 500 caracteres.',
        ];
    }

    /**
     * Comprobaciones que las reglas sueltas no cubren: el tamaño real de un mapa de bits y
     * el contenido de un SVG.
     */
    protected function validateLogoContent(Validator $validator): void
    {
        $logo = $this->file('logo');

        if (! $logo instanceof UploadedFile || ! $logo->isValid()) {
            return;
        }

        $mime = (string) $logo->getMimeType();

        if ($mime === 'image/svg+xml') {
            $this->rejectUnsafeSvg($validator, $logo);

            return;
        }

        $size = @getimagesize($logo->getPathname());

        if ($size === false) {
            $validator->errors()->add('logo', 'No se pudo leer la imagen; súbela de nuevo.');

            return;
        }

        [$width, $height] = $size;

        if ($width < self::MIN_LOGO_SIDE || $height < self::MIN_LOGO_SIDE) {
            $validator->errors()->add(
                'logo',
                'El logo debe medir al menos '.self::MIN_LOGO_SIDE.'×'.self::MIN_LOGO_SIDE.' píxeles; el enviado mide '.$width.'×'.$height.'.'
            );
        }
    }

    /**
     * Un SVG puede traer scripts o recursos remotos y se serviria desde nuestro dominio. Se
     * rechaza entero en vez de recortarlo: reescribir el archivo dejaria al usuario con un
     * logo distinto del que subio y sin saber por que.
     */
    protected function rejectUnsafeSvg(Validator $validator, UploadedFile $logo): void
    {
        $contents = @file_get_contents($logo->getPathname());

        if ($contents === false) {
            $validator->errors()->add('logo', 'No se pudo leer el archivo; súbelo de nuevo.');

            return;
        }

        if (! str_contains(strtolower($contents), '<svg')) {
            $validator->errors()->add('logo', 'El archivo no es un SVG válido.');

            return;
        }

        $unsafe = ['<script', '<foreignobject', 'javascript:', '<iframe', '<embed', '<use xlink:href="http'];
        $lower = strtolower($contents);

        foreach ($unsafe as $needle) {
            if (str_contains($lower, $needle)) {
                $validator->errors()->add(
                    'logo',
                    'El SVG contiene código ejecutable o recursos externos. Expórtalo de nuevo sin scripts, o sube un PNG.'
                );

                return;
            }
        }

        // Atributos de evento (onload, onclick…): mismo riesgo, sin la etiqueta <script>.
        if (preg_match('/\son[a-z]+\s*=/i', $contents) === 1) {
            $validator->errors()->add(
                'logo',
                'El SVG contiene atributos de evento. Expórtalo de nuevo sin interactividad, o sube un PNG.'
            );
        }
    }
}
