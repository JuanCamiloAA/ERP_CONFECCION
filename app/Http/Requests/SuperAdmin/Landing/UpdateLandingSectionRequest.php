<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLandingSectionRequest extends FormRequest
{
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
}
