<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required_unless:force_change,1', 'nullable', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'force_change' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.current_password' => 'La contrasena actual es incorrecta.',
            'password.required' => 'La nueva contrasena es obligatoria.',
            'password.confirmed' => 'Las contrasenas no coinciden.',
        ];
    }
}
