<?php

namespace App\Http\Requests\Employee;

use App\Http\Requests\Concerns\ValidatesAccessPassword;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeAccessRequest extends FormRequest
{
    use ValidatesAccessPassword;

    public function authorize(): bool
    {
        return $this->user()?->can('users.index.create') || $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ] + $this->accessPasswordRules();
    }

    public function messages(): array
    {
        return [
            'email.required' => 'El correo es obligatorio.',
            'email.unique' => 'Ya existe un usuario con ese correo.',
            'role_id.required' => 'Debes seleccionar un rol.',
        ] + $this->accessPasswordMessages();
    }
}
