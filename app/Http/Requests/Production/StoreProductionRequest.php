<?php

namespace App\Http\Requests\Production;

use App\Models\Payroll;
use App\Models\Reference;
use App\Support\ReferenceLotCapacity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProductionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('productions.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'reference_id' => ['required', 'integer', 'exists:references,id'],
            'operation_id' => ['required', 'integer', 'exists:operations,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'shift' => ['required', 'in:manana,tarde,noche'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'employee_id.required' => 'Debes seleccionar un empleado.',
            'reference_id.required' => 'Debes seleccionar una referencia.',
            'operation_id.required' => 'Debes seleccionar una operacion.',
            'quantity.min' => 'La cantidad minima es 1.',
            'date.before_or_equal' => 'La fecha no puede ser futura.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if ($user?->isRestrictedProductionAccount()
                && (int) $this->input('employee_id') !== (int) $user->employee_id) {
                $validator->errors()->add('employee_id', 'No puedes registrar produccion para otro empleado.');
            }

            $referenceId = $this->input('reference_id');
            $operationId = $this->input('operation_id');

            if ($referenceId && $operationId) {
                $reference = Reference::find($referenceId);
                if ($reference) {
                    $exists = $reference->operations()
                        ->where('operations.id', $operationId)
                        ->wherePivot('is_active', true)
                        ->exists();
                    if (! $exists) {
                        $validator->errors()->add('operation_id', 'La operacion no esta asociada o activa para esta referencia.');
                    }
                }
            }

            $referenceId = (int) $this->input('reference_id', 0);
            $operationId = (int) $this->input('operation_id', 0);
            $quantity = (int) $this->input('quantity', 0);
            if ($referenceId && $operationId && $quantity > 0) {
                ReferenceLotCapacity::assertWithinLot($validator, $referenceId, $operationId, $quantity);
            }

            $companyId = (int) ($user?->company_id ?? session('active_company_id', 0));
            $date = $this->input('date');
            if ($companyId && $date && Payroll::paidPeriodCoversDate($companyId, $date)) {
                $validator->errors()->add(
                    'date',
                    'No puedes registrar produccion en una fecha que ya pertenece a un periodo de nomina pagado.'
                );
            }
        });
    }
}
