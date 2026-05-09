<?php

namespace App\Http\Requests\ExpenseCategory;

use App\Models\ExpenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var ExpenseCategory $category */
        $category = $this->route('expense_category');
        $companyId = $this->user()?->company_id;

        return [
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('expense_categories', 'name')
                    ->where('company_id', $companyId)
                    ->ignore($category->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nombre',
            'description' => 'descripcion',
            'is_active' => 'activo',
            'sort_order' => 'orden',
        ];
    }
}
