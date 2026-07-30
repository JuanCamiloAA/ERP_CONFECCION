<?php

namespace App\Http\Requests\Concerns;

/**
 * Reglas compartidas para la contrasena de la cuenta de acceso de un empleado.
 *
 * Modo "auto": el formulario envia una contrasena generada en el cliente.
 * Modo "manual": el administrador digita contrasena y confirmacion.
 * Si no llega contrasena, el controlador genera una temporal (igual que la importacion CSV).
 */
trait ValidatesAccessPassword
{
    /** Debe incluir minuscula, mayuscula, numero y un caracter especial. */
    private const PASSWORD_COMPLEXITY = 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/';

    /**
     * @return array<string, list<string>>
     */
    protected function accessPasswordRules(): array
    {
        return [
            'password_mode' => ['nullable', 'string', 'in:auto,manual'],
            'user_password' => [
                'required_if:password_mode,manual',
                'nullable',
                'string',
                'min:8',
                'max:72',
                self::PASSWORD_COMPLEXITY,
            ],
            'user_password_confirmation' => [
                'required_if:password_mode,manual',
                'nullable',
                'string',
                'same:user_password',
            ],
            'require_password_change' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function accessPasswordMessages(): array
    {
        return [
            'password_mode.in' => 'Modo de contrasena no valido.',
            'user_password.required_if' => 'La contrasena es obligatoria en modo manual.',
            'user_password.min' => 'La contrasena debe tener al menos 8 caracteres.',
            'user_password.max' => 'La contrasena no puede superar los 72 caracteres.',
            'user_password.regex' => 'La contrasena debe incluir mayusculas, minusculas, numeros y un caracter especial.',
            'user_password_confirmation.required_if' => 'Debes confirmar la contrasena.',
            'user_password_confirmation.same' => 'La confirmacion de contrasena no coincide.',
        ];
    }
}
