<?php

namespace App\Http\Requests\Production;

use App\Models\Payroll;
use App\Models\Production;
use App\Models\Reference;
use App\Support\ReferenceLotCapacity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateProductionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('productions.index.edit') || $this->user()?->isSuperAdmin();
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
            // `pagado` no esta: ese estado lo pone el cierre de nomina, no el formulario.
            'status' => ['sometimes', 'nullable', 'in:'.implode(',', Production::EDITABLE_STATUSES)],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if ($user?->isRestrictedProductionAccount()
                && (int) $this->input('employee_id') !== (int) $user->employee_id) {
                $validator->errors()->add('employee_id', 'No puedes asignar este registro a otro empleado.');
            }

            $referenceIdIn = $this->input('reference_id');
            $operationIdIn = $this->input('operation_id');

            // Un registro de una programacion ya cerrada que conserva su referencia y su
            // operacion no tiene por que encontrar esa linea en el detalle de hoy: al
            // reprogramar la linea pudo quitarse o cerrarse, y existia cuando se registro.
            // El tope de su lote se sigue validando abajo.
            $stored = $this->route('production');
            $closedLotLine = $stored instanceof Production
                && (int) $stored->reference_id === (int) $referenceIdIn
                && (int) $stored->operation_id === (int) $operationIdIn
                && (int) ($stored->lot_number ?: 1) !== (int) (Reference::query()->withoutGlobalScopes()->whereKey($stored->reference_id)->value('lot_number') ?? 1);

            if ($referenceIdIn && $operationIdIn && ! $closedLotLine) {
                $reference = Reference::find($referenceIdIn);
                if ($reference) {
                    $exists = $reference->operations()
                        ->where('operations.id', $operationIdIn)
                        ->wherePivot('is_active', true)
                        ->exists();
                    if (! $exists) {
                        $validator->errors()->add('operation_id', 'La operacion no esta asociada o activa para esta referencia.');
                    }
                }
            }

            /** @var Production|null $production */
            $production = $this->route('production');
            $referenceId = (int) $this->input('reference_id', 0);
            $operationId = (int) $this->input('operation_id', 0);
            $quantity = (int) $this->input('quantity', 0);
            if ($referenceId && $operationId && $quantity > 0) {
                // Si el registro sigue en su referencia, se mide contra SU programacion
                // (puede ser una ya cerrada); si cambia de referencia, entra en la vigente.
                $sameReference = $production instanceof Production
                    && (int) $production->reference_id === $referenceId;

                ReferenceLotCapacity::assertWithinLot(
                    $validator,
                    $referenceId,
                    $operationId,
                    $quantity,
                    $production?->id,
                    $sameReference ? (int) ($production->lot_number ?: 1) : null,
                );
            }

            if ($production instanceof Production) {
                $companyId = (int) $production->company_id;
                $existingDate = $production->date instanceof \DateTimeInterface
                    ? $production->date->format('Y-m-d')
                    : (string) $production->getRawOriginal('date');
                $newDate = $this->input('date');

                if ($companyId && Payroll::paidPeriodCoversDate($companyId, $existingDate)) {
                    $validator->errors()->add(
                        'date',
                        'No se puede modificar produccion que pertenece a un periodo de nomina ya pagado.'
                    );
                } elseif ($companyId && $newDate && Payroll::paidPeriodCoversDate($companyId, $newDate)) {
                    $validator->errors()->add(
                        'date',
                        'La fecha indicada cae en un periodo de nomina ya pagado. Elige otra fecha o consulta con administracion.'
                    );
                }
            }
        });
    }
}
