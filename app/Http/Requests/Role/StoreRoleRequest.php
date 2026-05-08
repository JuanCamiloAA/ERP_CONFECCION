<?php

namespace App\Http\Requests\Role;

use App\Helpers\PermissionHelper;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('roles.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $actor = $this->user();
        $targetCompanyId = $actor?->isSuperAdmin()
            ? ($this->filled('company_id') ? (int) $this->input('company_id') : null)
            : $actor?->company_id;

        $rules = [
            'display_name' => ['required', 'string', 'max:80'],
            'name' => [
                'required',
                'string',
                'max:80',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')->where(fn ($q) => $q->where('company_id', $targetCompanyId)),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'color' => ['nullable', 'string', 'max:9'],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ];

        if ($actor?->isSuperAdmin()) {
            $rules['company_id'] = ['required', 'integer', 'exists:companies,id'];
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $permissions = (array) $this->input('permissions', []);
            $hasView = collect($permissions)->contains(fn ($p) => str_ends_with($p, '.view'));
            if (! $hasView) {
                $validator->errors()->add('permissions', 'El rol debe tener al menos un permiso de tipo "ver".');
            }

            foreach ($permissions as $perm) {
                if (! PermissionHelper::permissionExists($perm)) {
                    $validator->errors()->add('permissions', "Permiso invalido: {$perm}.");
                    break;
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.regex' => 'El nombre interno solo puede contener letras minusculas, numeros y guiones bajos.',
            'name.unique' => 'Ya existe un rol con ese nombre interno.',
        ];
    }
}
