<?php

namespace App\Services\Employee;

use App\Models\Advance;
use App\Models\Bank;
use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\EmployeeRequest;
use App\Models\Production;
use App\Models\User;
use App\Services\Account\AccountNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Ciclo de las solicitudes del empleado: radicar, aprobar y rechazar.
 *
 * Aprobar es lo unico que escribe el dato real. Hasta entonces la solicitud es una
 * propuesta guardada aparte, y el empleado sigue viendo su cuenta bancaria de siempre:
 * ese es el punto de todo el mecanismo.
 *
 * Una correccion de produccion NO modifica el registro por su cuenta: deja constancia y
 * avisa a quien revisa. Cambiar cantidades ya liquidadas desde aqui pasaria por encima de
 * las reglas del modulo de produccion (registros pagados que no se tocan, recalculo de
 * nomina), y ese modulo esta fuera del alcance de esta pantalla.
 */
class EmployeeRequestService
{
    public function __construct(protected EmployeeAuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws ValidationException
     */
    public function create(Employee $employee, string $type, array $payload, User $requester): EmployeeRequest
    {
        if (! in_array($type, EmployeeRequest::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Tipo de solicitud no válido.']);
        }

        $payload = $this->normalizePayload($employee, $type, $payload);

        // Una segunda solicitud del mismo tipo mientras la primera sigue en revision solo
        // genera trabajo doble a quien aprueba.
        $duplicate = EmployeeRequest::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->where('type', $type)
            ->where('status', EmployeeRequest::STATUS_PENDING)
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'type' => 'Ya tienes una solicitud de este tipo en revisión.',
            ]);
        }

        $request = EmployeeRequest::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'requested_by' => $requester->id,
            'type' => $type,
            'payload' => $payload,
            'status' => EmployeeRequest::STATUS_PENDING,
        ]);

        $this->audit->log(
            $employee,
            EmployeeAuditLog::EVENT_REQUEST_CREATED,
            null,
            null,
            $request->typeLabel(),
            $requester,
        );

        // Avisa a quien puede aprobar. Va al final y por el notificador, que respeta la
        // preferencia de cada persona y se traga los fallos de correo: una caida del
        // proveedor no puede impedir que el empleado radique su solicitud.
        app(AccountNotifier::class)->pendingApproval($request, $employee->full_name);

        return $request;
    }

    /**
     * Aprueba y aplica el cambio real en la misma transaccion: una solicitud marcada como
     * aprobada cuyo efecto no se guardo seria peor que un fallo.
     */
    public function approve(EmployeeRequest $request, User $reviewer): string
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages(['status' => 'Esta solicitud ya fue revisada.']);
        }

        return DB::transaction(function () use ($request, $reviewer) {
            $employee = $request->employee;

            abort_if($employee === null, 404);

            [$message, $auditField, $auditDetail] = $this->applyApproved($request, $employee, $reviewer);

            $request->forceFill([
                'status' => EmployeeRequest::STATUS_APPROVED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'rejection_reason' => null,
            ])->save();

            // Una sola linea por aprobacion. El detalle lo pone cada tipo: el monto en un
            // anticipo, la cuenta enmascarada en un cambio de datos. Registrar ademas una
            // linea generica dejaba la bitacora con dos filas por el mismo hecho.
            $this->audit->log(
                $employee,
                EmployeeAuditLog::EVENT_REQUEST_APPROVED,
                $auditField,
                null,
                $auditDetail ?? $request->typeLabel(),
                $reviewer,
            );

            return $message;
        });
    }

    public function reject(EmployeeRequest $request, User $reviewer, string $reason): void
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages(['status' => 'Esta solicitud ya fue revisada.']);
        }

        $request->forceFill([
            'status' => EmployeeRequest::STATUS_REJECTED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'rejection_reason' => $reason,
        ])->save();

        $this->audit->log(
            $request->employee,
            EmployeeAuditLog::EVENT_REQUEST_REJECTED,
            null,
            $request->typeLabel(),
            $reason,
            $reviewer,
        );
    }

    // ------------------------------------------------------------------ aplicacion

    /**
     * Aplica el efecto real de la solicitud.
     *
     * @return array{0: string, 1: string|null, 2: string|null} mensaje, campo y detalle de bitácora
     */
    protected function applyApproved(EmployeeRequest $request, Employee $employee, User $reviewer): array
    {
        $payload = $request->payload ?? [];

        return match ($request->type) {
            EmployeeRequest::TYPE_ADVANCE => $this->applyAdvance($employee, $payload, $reviewer),
            EmployeeRequest::TYPE_PROFILE_CHANGE => $this->applyBankChange($employee, $payload, $reviewer),
            EmployeeRequest::TYPE_PRODUCTION_CORRECTION => [
                'Corrección marcada como atendida.',
                null,
                'Corrección de producción del '.($payload['production_date'] ?? '—'),
            ],
            default => ['Solicitud aprobada.', null, null],
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{0: string, 1: string|null, 2: string|null}
     */
    protected function applyAdvance(Employee $employee, array $payload, User $reviewer): array
    {
        $amount = round((float) ($payload['amount'] ?? 0), 2);

        Advance::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'amount' => $amount,
            'remaining_amount' => $amount,
            'applied_amount' => 0,
            'date' => $payload['date'] ?? Carbon::today()->toDateString(),
            'reason' => $payload['reason'] ?? 'Anticipo solicitado por el empleado',
            'status' => Advance::STATUS_PENDING,
            'created_by' => $reviewer->id,
        ]);

        return ['Anticipo aprobado y registrado.', 'advance', '$ '.number_format($amount, 0, ',', '.')];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{0: string, 1: string|null, 2: string|null}
     */
    protected function applyBankChange(Employee $employee, array $payload, User $reviewer): array
    {
        $before = [
            'bank_id' => $employee->bank_id,
            'bank_account_type' => $employee->bank_account_type,
            'bank_account_number' => $employee->bank_account_number,
            'bank_key' => $employee->bank_key,
        ];

        $after = [
            'bank_id' => $payload['bank_id'] ?? null,
            'bank_account_type' => $payload['bank_account_type'] ?? null,
            'bank_account_number' => $payload['bank_account_number'] ?? null,
            'bank_key' => $payload['bank_key'] ?? null,
        ];

        $employee->fill($after);
        $employee->save();

        // Aquí sí hay una línea por campo además de la de la aprobación: lo que cambió es
        // el dato vigente del empleado, y eso es exactamente lo que la bitácora audita.
        $this->audit->logChanges($employee, $before, $after, EmployeeAuditLog::EVENT_REQUEST_APPROVED, $reviewer);

        return ['Cuenta bancaria actualizada.', null, 'Cambio de cuenta bancaria aprobado'];
    }

    // ------------------------------------------------------------------ validacion

    /**
     * Deja el payload de cada tipo con la forma exacta que espera la aprobacion. Lo que
     * no se valide aqui se convierte en un error el dia que alguien aprueba.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    protected function normalizePayload(Employee $employee, string $type, array $payload): array
    {
        return match ($type) {
            EmployeeRequest::TYPE_ADVANCE => $this->normalizeAdvance($payload),
            EmployeeRequest::TYPE_PROFILE_CHANGE => $this->normalizeBankChange($employee, $payload),
            EmployeeRequest::TYPE_PRODUCTION_CORRECTION => $this->normalizeCorrection($employee, $payload),
            default => [],
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function normalizeAdvance(array $payload): array
    {
        $amount = round((float) ($payload['amount'] ?? 0), 2);
        $reason = trim((string) ($payload['reason'] ?? ''));

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'El monto debe ser mayor que cero.']);
        }

        if ($reason === '') {
            throw ValidationException::withMessages(['reason' => 'Indica el motivo del anticipo.']);
        }

        $date = trim((string) ($payload['date'] ?? '')) ?: Carbon::today()->toDateString();

        try {
            $date = Carbon::parse($date)->toDateString();
        } catch (\Throwable) {
            throw ValidationException::withMessages(['date' => 'La fecha no es válida.']);
        }

        return [
            'amount' => $amount,
            'reason' => mb_substr($reason, 0, 255),
            'date' => $date,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function normalizeBankChange(Employee $employee, array $payload): array
    {
        $bankId = (int) ($payload['bank_id'] ?? 0);
        $account = trim((string) ($payload['bank_account_number'] ?? ''));
        $key = trim((string) ($payload['bank_key'] ?? ''));
        $accountType = trim((string) ($payload['bank_account_type'] ?? ''));

        $bank = $bankId > 0
            ? Bank::withoutGlobalScopes()->where('company_id', $employee->company_id)->find($bankId)
            : null;

        if (! $bank) {
            throw ValidationException::withMessages(['bank_id' => 'Selecciona un banco válido.']);
        }

        if (! $bank->is_active) {
            throw ValidationException::withMessages(['bank_id' => 'Ese banco no está disponible.']);
        }

        if ($account === '' || ! preg_match('/^[0-9]{1,34}$/', $account)) {
            throw ValidationException::withMessages(['bank_account_number' => 'La cuenta solo admite dígitos.']);
        }

        if ($bank->requires_key && $key === '') {
            throw ValidationException::withMessages(['bank_key' => 'Este banco exige clave de dispersión.']);
        }

        if ($key !== '' && ! preg_match('/^[0-9A-Za-z]{1,100}$/', $key)) {
            throw ValidationException::withMessages(['bank_key' => 'La clave solo admite letras y dígitos.']);
        }

        if ($bank->type !== 'wallet' && $accountType !== '' && ! in_array(mb_strtolower($accountType), ['ahorros', 'corriente'], true)) {
            throw ValidationException::withMessages(['bank_account_type' => 'El tipo de cuenta debe ser ahorros o corriente.']);
        }

        return [
            'bank_id' => $bank->id,
            'bank_name' => $bank->name,
            'bank_account_number' => $account,
            'bank_key' => $key !== '' ? $key : null,
            'bank_account_type' => $bank->type === 'wallet' || $accountType === '' ? null : mb_strtolower($accountType),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function normalizeCorrection(Employee $employee, array $payload): array
    {
        $description = trim((string) ($payload['description'] ?? ''));

        if ($description === '') {
            throw ValidationException::withMessages(['description' => 'Describe qué está mal en el registro.']);
        }

        $productionId = (int) ($payload['production_id'] ?? 0);

        // El registro tiene que ser suyo: sin esta comprobacion, un operario podria
        // radicar correcciones sobre la produccion de cualquier compañero.
        $production = $productionId > 0
            ? Production::query()
                ->withoutGlobalScopes()
                ->whereNull('deleted_at')
                ->where('employee_id', $employee->id)
                ->find($productionId)
            : null;

        if (! $production) {
            throw ValidationException::withMessages([
                'production_id' => 'Selecciona uno de tus registros de producción.',
            ]);
        }

        return [
            'production_id' => $production->id,
            'production_date' => $production->date?->toDateString(),
            'production_quantity' => (int) $production->quantity,
            'description' => mb_substr($description, 0, 500),
            'suggested_quantity' => isset($payload['suggested_quantity']) && $payload['suggested_quantity'] !== ''
                ? max(0, (int) $payload['suggested_quantity'])
                : null,
        ];
    }
}
