<?php

namespace App\Http\Requests\Expense;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return [
            'category_id' => [
                'required',
                'integer',
                Rule::exists('expense_categories', 'id')
                    ->where('company_id', $companyId)
                    ->where('is_active', true),
            ],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['required', 'string', 'max:500'],
            'expense_date' => ['required', 'date', 'before_or_equal:today', 'after:2000-01-01'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ];
    }

    public function attributes(): array
    {
        return [
            'category_id' => 'categoria',
            'amount' => 'monto',
            'description' => 'descripcion',
            'expense_date' => 'fecha del gasto',
            'notes' => 'notas',
            'receipt' => 'comprobante',
        ];
    }
}
