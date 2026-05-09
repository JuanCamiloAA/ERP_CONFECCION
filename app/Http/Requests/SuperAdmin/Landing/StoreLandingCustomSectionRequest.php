<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use Illuminate\Foundation\Http\FormRequest;

class StoreLandingCustomSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'title_internal' => ['required', 'string', 'max:120'],
        ];
    }
}
