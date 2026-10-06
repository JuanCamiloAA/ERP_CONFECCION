<?php

namespace App\Http\Requests\SuperAdmin;

use App\Models\BillingCycle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SaveBillingCycleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['code' => Str::slug((string) ($this->input('code') ?: $this->input('name')), '_')]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var BillingCycle|null $cycle */
        $cycle = $this->route('billing_cycle');

        return [
            'name' => ['required', 'string', 'max:60'],
            'code' => ['required', 'string', 'max:40', Rule::unique('billing_cycles', 'code')->ignore($cycle?->id)],
            'months' => ['required', 'integer', 'min:1', 'max:36'],
            'discount_percent' => ['required', 'integer', 'min:0', 'max:90'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del periodo.',
            'code.unique' => 'Ya hay un periodo con ese código.',
            'months.min' => 'Un periodo dura al menos un mes.',
            'months.max' => 'Un periodo dura máximo 36 meses.',
            'discount_percent.max' => 'El descuento no puede pasar del 90 %.',
        ];
    }
}
