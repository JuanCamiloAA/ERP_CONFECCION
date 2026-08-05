<?php

namespace App\Http\Requests\Holiday;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'country_code' => ['nullable', 'string', 'size:2'],
            'date' => [
                'required',
                'date',
                Rule::unique('holidays', 'date')->where(
                    fn ($q) => $q->where('country_code', $this->input('country_code', 'CO'))
                ),
            ],
            'name' => ['required', 'string', 'max:150'],
        ];
    }

    public function messages(): array
    {
        return [
            'date.unique' => 'Ya existe un festivo registrado en esa fecha.',
        ];
    }
}
