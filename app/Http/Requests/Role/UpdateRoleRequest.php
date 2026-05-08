<?php

namespace App\Http\Requests\Role;

use App\Helpers\PermissionHelper;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $role = $this->route('role');
        if ($role && $role->is_system) {
            return false;
        }

        return $this->user()?->can('roles.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $actor = $this->user();
        $role = $this->route('role');
        $companyId = ($actor?->isSuperAdmin() && $role) ? $role->company_id : $actor?->company_id;
        $roleId = $role?->id ?? $this->route('role');

        return [
            'display_name' => ['required', 'string', 'max:80'],
            'name' => [
                'required',
                'string',
                'max:80',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')
                    ->where(fn ($q) => $q->where('company_id', $companyId))
                    ->ignore($roleId),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'color' => ['nullable', 'string', 'max:9'],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ];
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
}
