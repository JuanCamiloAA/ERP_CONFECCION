<?php

namespace App\Http\Requests\Expense;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use Illuminate\Foundation\Http\FormRequest;

class UpdateExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['required', 'string', 'max:500'],
            'expense_date' => ['required', 'date', 'before_or_equal:today', 'after:2000-01-01'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['sometimes', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
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

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Expense $expense */
            $expense = $this->route('expense');
            $companyId = $this->user()?->company_id;
            $categoryId = (int) $this->input('category_id');

            $category = ExpenseCategory::query()
                ->where('id', $categoryId)
                ->where('company_id', $companyId)
                ->first();

            if (! $category) {
                $validator->errors()->add('category_id', 'La categoría no es válida para su empresa.');

                return;
            }

            if (! $category->is_active && (int) $category->id !== (int) $expense->category_id) {
                $validator->errors()->add('category_id', 'No puede usar una categoría inactiva salvo mantener la actual.');
            }
        });
    }
}
