<?php

namespace App\Services\Employee;

use App\Contracts\ObjectStorageInterface;
use App\Models\Bank;
use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\User;
use App\Services\Files\StoredFileDeleter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Guardado por seccion de la ficha.
 *
 * El formulario monolitico obligaba a reenviar los veinte campos para cambiar un
 * telefono: un error de validacion en el bloque de nomina tiraba tambien lo escrito en
 * contacto. Aqui cada seccion valida y guarda solo lo suyo, de modo que un fallo en una
 * no puede descartar lo que el usuario escribio en otra.
 *
 * Las reglas de cada seccion son las mismas de `UpdateEmployeeRequest` recortadas al
 * bloque, no unas nuevas: si la validacion divergiera, la ficha y el formulario completo
 * aceptarian datos distintos para la misma columna.
 */
class EmployeeSectionUpdater
{
    public function __construct(
        protected EmployeeAuditLogger $audit,
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    /**
     * Aplica una seccion y devuelve el mensaje de exito.
     *
     * @throws ValidationException
     */
    public function apply(Request $request, Employee $employee, string $section, User $actor): string
    {
        return match ($section) {
            'identity' => $this->applyIdentity($request, $employee, $actor),
            'contact' => $this->applyContact($request, $employee, $actor),
            'payroll' => $this->applyPayroll($request, $employee, $actor),
            'bank' => $this->applyBank($request, $employee, $actor),
            'notes' => $this->applyNotes($request, $employee, $actor),
            'lifecycle' => $this->applyLifecycle($request, $employee, $actor),
            default => throw ValidationException::withMessages(['section' => 'Sección no válida.']),
        };
    }

    // ------------------------------------------------------------------ identidad

    protected function applyIdentity(Request $request, Employee $employee, User $actor): string
    {
        // El empleado corrige su nombre y su foto; el documento y la fecha de ingreso son
        // datos del contrato y los toca administracion. Un administrador que mira su
        // propia ficha sigue siendo administrador: lo que manda es el permiso, no el modo.
        $administrative = $actor->can('employees.profile.edit_section') || $actor->isSuperAdmin();

        $rules = [
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'photo' => ['nullable', 'image', 'max:2048'],
        ];

        if ($administrative) {
            $rules += [
                'document_type' => ['required', 'string', 'in:CC,CE,TI,PAS,NIT'],
                'document_number' => [
                    'required',
                    'string',
                    'max:30',
                    Rule::unique('employees', 'document_number')
                        ->where(fn ($q) => $q->where('company_id', $employee->company_id))
                        ->ignore($employee->id),
                ],
                'hire_date' => ['required', 'date'],
            ];
        }

        $data = $this->validate($request, $rules);
        unset($data['photo']);

        if ($request->hasFile('photo')) {
            $this->storedFileDeleter->deleteIfPresent($employee->getAttributes()['photo'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('photo'),
                "companies/{$employee->company_id}/employees/{$employee->id}"
            );
            $data['photo'] = $uploaded['path'];
        }

        $this->save($employee, $data, $actor);

        // La cuenta de acceso lleva el mismo nombre y la misma foto que la ficha: si no se
        // propaga, el empleado se cambia el nombre y el menu superior le sigue diciendo el
        // anterior.
        $this->syncUserFromEmployee($employee, $data);

        return 'Identidad actualizada.';
    }

    // ------------------------------------------------------------------ contacto

    protected function applyContact(Request $request, Employee $employee, User $actor): string
    {
        $data = $this->validate($request, [
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'emergency_contact_name' => ['nullable', 'string', 'max:120'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:40'],
        ]);

        $data = $this->blanksToNull($data);

        $this->save($employee, $data, $actor);
        $this->syncUserFromEmployee($employee, $data);

        return 'Datos de contacto actualizados.';
    }

    // ------------------------------------------------------------------ nomina

    protected function applyPayroll(Request $request, Employee $employee, User $actor): string
    {
        $mode = (string) $request->input('payroll_mode', $employee->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS);

        $data = $this->validate($request, [
            'payroll_mode' => ['required', 'string', Rule::in([
                Employee::PAYROLL_MODE_OPERATIONS,
                Employee::PAYROLL_MODE_FIXED_DAILY,
                Employee::PAYROLL_MODE_HOURLY_LEGAL,
            ])],
            'base_salary' => [
                'nullable',
                'required_if:payroll_mode,'.Employee::PAYROLL_MODE_HOURLY_LEGAL,
                'numeric',
                'min:0',
            ],
            'daily_salary' => [
                'nullable',
                'required_if:payroll_mode,'.Employee::PAYROLL_MODE_FIXED_DAILY,
                'numeric',
                'min:0',
            ],
            'minutes_per_full_workday' => ['nullable', 'integer', 'min:60', 'max:1440'],
            'ordinary_hours_per_day' => [
                'nullable',
                'required_if:payroll_mode,'.Employee::PAYROLL_MODE_HOURLY_LEGAL,
                'numeric',
                'min:1',
                'max:12',
            ],
            'is_exempt_from_overtime' => ['nullable', 'boolean'],
            'scheduled_work_days' => ['nullable', 'array'],
            'scheduled_work_days.*' => ['integer', 'min:1', 'max:7'],
        ]);

        // Normalizacion identica a `EmployeeController@update`: las columnas de una
        // modalidad no se quedan con el valor de la anterior al cambiar de modo.
        $data['base_salary'] = $data['base_salary'] ?? 0;
        $data['daily_salary'] = $mode === Employee::PAYROLL_MODE_FIXED_DAILY ? ($data['daily_salary'] ?? 0) : null;
        $data['minutes_per_full_workday'] = (int) ($data['minutes_per_full_workday'] ?? 480);
        $data['ordinary_hours_per_day'] = $mode === Employee::PAYROLL_MODE_HOURLY_LEGAL ? ($data['ordinary_hours_per_day'] ?? 8) : 8;
        $data['is_exempt_from_overtime'] = (bool) ($data['is_exempt_from_overtime'] ?? false);
        $data['scheduled_work_days'] = $data['scheduled_work_days'] ?? Employee::DEFAULT_SCHEDULED_WORK_DAYS;

        $this->save($employee, $data, $actor);

        return 'Datos de nómina actualizados.';
    }

    // ------------------------------------------------------------------ datos de pago

    protected function applyBank(Request $request, Employee $employee, User $actor): string
    {
        $bankId = $request->input('bank_id');
        $bankId = ($bankId === '' || $bankId === null) ? null : (int) $bankId;
        $account = trim((string) $request->input('bank_account_number', '')) ?: null;
        $key = trim((string) $request->input('bank_key', '')) ?: null;
        $type = trim((string) $request->input('bank_account_type', '')) ?: null;

        // Vaciar el grupo entero es una opcion valida: el empleado se queda sin datos de
        // pago hasta que los traiga. Lo que no vale es dejar la cuenta sin banco.
        if ($bankId === null && $account === null && $key === null) {
            $this->save($employee, [
                'bank_id' => null,
                'bank_account_number' => null,
                'bank_key' => null,
                'bank_account_type' => null,
            ], $actor);

            return 'Datos de pago actualizados.';
        }

        $bank = $bankId !== null
            ? Bank::withoutGlobalScopes()->where('company_id', $employee->company_id)->find($bankId)
            : null;

        if ($bankId !== null && ! $bank) {
            throw ValidationException::withMessages(['bank_id' => 'Banco no válido para esta empresa.']);
        }

        if ($bank && ! $bank->is_active && (int) $bank->id !== (int) $employee->bank_id) {
            throw ValidationException::withMessages([
                'bank_id' => 'El banco seleccionado está inactivo. Elija otro o deje los datos de pago en blanco.',
            ]);
        }

        $request->merge([
            'bank_id' => $bankId,
            'bank_account_number' => $account,
            'bank_key' => $key,
            // Una billetera digital no tiene tipo de cuenta.
            'bank_account_type' => $bank?->type === 'wallet' ? null : ($type !== null ? mb_strtolower($type) : null),
        ]);

        $requiresKey = $bank?->requires_key ?? true;

        $data = $this->validate($request, [
            'bank_id' => ['required', 'integer'],
            'bank_account_number' => ['required', 'string', 'max:34', 'regex:/^[0-9]+$/'],
            // Hay entidades que no piden clave de dispersion (las billeteras): exigirla
            // siempre dejaria esos datos de pago sin poder guardarse.
            'bank_key' => array_merge(
                $requiresKey ? ['required'] : ['nullable'],
                ['string', 'max:100', 'regex:/^[0-9A-Za-z]+$/'],
            ),
            'bank_account_type' => ['nullable', 'string', Rule::in(['ahorros', 'corriente'])],
        ], [
            'bank_key.required' => 'Este banco exige clave de dispersión.',
            'bank_account_number.regex' => 'La cuenta solo admite dígitos.',
            'bank_account_type.in' => 'El tipo de cuenta debe ser ahorros o corriente.',
        ]);

        $this->save($employee, $data, $actor);

        return 'Datos de pago actualizados.';
    }

    // ------------------------------------------------------------------ notas

    protected function applyNotes(Request $request, Employee $employee, User $actor): string
    {
        $data = $this->validate($request, [
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->save($employee, $this->blanksToNull($data), $actor);

        return 'Notas actualizadas.';
    }

    // ------------------------------------------------------------------ ciclo de vida

    /**
     * Ciclo de vida y retiro.
     *
     * Retirar arrastra tres cosas que antes habia que acordarse de hacer una por una:
     * inactivar al empleado, revocar su acceso y dejar constancia del motivo. Volver a un
     * estado anterior reactiva al empleado pero NO devuelve el acceso: eso es una decision
     * aparte, con su propio permiso y su propia linea en la bitacora.
     */
    protected function applyLifecycle(Request $request, Employee $employee, User $actor): string
    {
        $data = $this->validate($request, [
            'lifecycle_status' => ['required', 'string', Rule::in(Employee::LIFECYCLE_FLOW)],
            'termination_date' => ['nullable', 'required_if:lifecycle_status,'.Employee::LIFECYCLE_TERMINATED, 'date'],
            'termination_reason' => ['nullable', 'required_if:lifecycle_status,'.Employee::LIFECYCLE_TERMINATED, 'string', 'max:255'],
        ], [
            'termination_date.required_if' => 'La fecha de retiro es obligatoria.',
            'termination_reason.required_if' => 'El motivo del retiro es obligatorio.',
        ]);

        $terminating = $data['lifecycle_status'] === Employee::LIFECYCLE_TERMINATED;

        $payload = [
            'lifecycle_status' => $data['lifecycle_status'],
            'termination_date' => $terminating ? $data['termination_date'] : null,
            'termination_reason' => $terminating ? $data['termination_reason'] : null,
            'is_active' => ! $terminating,
        ];

        DB::transaction(function () use ($employee, $payload, $actor, $terminating) {
            $this->save($employee, $payload, $actor, EmployeeAuditLog::EVENT_LIFECYCLE_CHANGED);

            if ($terminating && $employee->user && $employee->user->is_active) {
                $employee->user->is_active = false;
                $employee->user->save();

                $this->audit->log(
                    $employee,
                    EmployeeAuditLog::EVENT_ACCESS_TOGGLED,
                    'access',
                    'Activa',
                    'Revocada por retiro',
                    $actor,
                );
            }
        });

        return $terminating
            ? 'Empleado retirado. El acceso al sistema quedó revocado.'
            : 'Ciclo de vida actualizado.';
    }

    // ------------------------------------------------------------------ utilidades

    /**
     * @param  array<string, mixed>  $rules
     * @param  array<string, string>  $messages
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    protected function validate(Request $request, array $rules, array $messages = []): array
    {
        return $request->validate($rules, $messages);
    }

    /**
     * Guarda solo las claves de la seccion y deja la linea de bitacora por cada cambio
     * real.
     *
     * El `before` se lee con `getAttribute`, no con `getAttributes()`: el valor crudo de
     * `scheduled_work_days` es la cadena JSON y el que llega del formulario es un arreglo,
     * asi que compararlos marcaria un cambio en cada guardado. Pasando por el casteo, los
     * dos lados hablan el mismo idioma.
     *
     * @param  array<string, mixed>  $data
     */
    protected function save(Employee $employee, array $data, User $actor, string $event = EmployeeAuditLog::EVENT_SECTION_UPDATED): void
    {
        $before = [];
        foreach (array_keys($data) as $field) {
            $before[$field] = $employee->getAttribute($field);
        }

        $employee->fill($data);
        $employee->save();

        $this->audit->logChanges($employee, $before, $data, $event, $actor);
    }

    /**
     * Propaga a la cuenta de acceso los campos que comparte con la ficha.
     *
     * Solo se tocan los que efectivamente llegaron en la seccion, para no pisar con null
     * un correo de acceso que nada tiene que ver con el correo personal del empleado.
     *
     * @param  array<string, mixed>  $data
     */
    protected function syncUserFromEmployee(Employee $employee, array $data): void
    {
        $user = $employee->user;

        if (! $user) {
            return;
        }

        $patch = [];

        if (array_key_exists('first_name', $data)) {
            $patch['name'] = $employee->first_name;
        }
        if (array_key_exists('last_name', $data)) {
            $patch['last_name'] = $employee->last_name;
        }
        if (array_key_exists('phone', $data)) {
            $patch['phone'] = $employee->phone;
        }
        if (array_key_exists('photo', $data)) {
            $patch['avatar'] = $employee->getAttributes()['photo'] ?? null;
        }

        if ($patch !== []) {
            $user->fill($patch);
            $user->save();
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function blanksToNull(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($value) && trim($value) === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    protected function isSelf(User $actor, Employee $employee): bool
    {
        return $actor->employee_id !== null && (int) $actor->employee_id === (int) $employee->id;
    }
}
