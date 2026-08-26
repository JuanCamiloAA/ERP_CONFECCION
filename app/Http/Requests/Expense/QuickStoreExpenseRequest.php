<?php

namespace App\Http\Requests\Expense;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Captura rapida desde el movil: foto, monto y categoria.
 *
 * Pide menos que el formulario completo a proposito —la descripcion se completa
 * despues—, pero no afloja en el comprobante: la foto del recibo es lo unico que no se
 * puede reconstruir al volver al escritorio.
 */
class QuickStoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = TenantContext::effectiveCompanyId($this->user());

        return [
            'category_id' => [
                'required',
                'integer',
                Rule::exists('expense_categories', 'id')
                    ->where('company_id', $companyId)
                    ->where('is_active', true),
            ],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'receipt' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ];
    }

    public function attributes(): array
    {
        return [
            'category_id' => 'categoría',
            'amount' => 'monto',
            'receipt' => 'comprobante',
        ];
    }

    public function messages(): array
    {
        return [
            'receipt.required' => 'La foto del comprobante es obligatoria.',
        ];
    }
}
