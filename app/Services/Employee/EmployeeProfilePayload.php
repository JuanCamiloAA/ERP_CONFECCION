<?php

namespace App\Services\Employee;

use App\Models\Advance;
use App\Models\Bank;
use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\EmployeeRequest;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\Production;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkDaySession;
use App\Services\Files\MediaUrlResolver;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * Payload unico de la ficha de una persona, sea «mi perfil» o «la ficha de otro».
 *
 * Existe un solo armador porque existe una sola pantalla: si el perfil y la ficha
 * calcularan sus propios datos volverian a separarse a la primera correccion, que es de
 * donde venia el modulo. Lo que cambia entre los dos modos no es el contenido del
 * payload sino los booleanos de `permissions`, y esos los decide `EmployeePolicy`.
 *
 * Regla que no se rompe: el numero de cuenta y la llave bancaria NUNCA salen en claro de
 * aqui, ni para quien tiene permiso. Lo que viaja es su forma enmascarada; para operar
 * con el dato real estan la exportacion de dispersion y el formulario de edicion, que
 * son otros caminos con su propio permiso.
 */
class EmployeeProfilePayload
{
    /** Dias sin registrar produccion a partir de los cuales la ficha levanta la alerta. */
    protected const PRODUCTION_SILENCE_DAYS = 7;

    /** Clave de ajustes con la meta de unidades por periodo de la empresa. */
    public const UNITS_GOAL_SETTING = 'employee_units_goal_per_period';

    public function __construct(protected MediaUrlResolver $media) {}

    /**
     * @param  'self'|'admin'  $mode
     * @return array<string, mixed>
     */
    public function build(Employee $employee, User $viewer, string $mode): array
    {
        $employee->loadMissing(['user.roles', 'bank', 'company:id,name']);

        $permissions = $this->permissions($employee, $viewer);
        $period = $this->currentPeriod($employee);

        return [
            'mode' => $mode,
            'employeeId' => $employee->id,
            'identity' => $this->identity($employee),
            'contact' => $this->contact($employee),
            'payroll' => $this->payroll($employee, $permissions['canViewSalary']),
            'bankAccount' => $this->bankAccount($employee, $permissions['canViewBankAccount']),
            // Notas internas de administracion. En modo `self` solo las recibe quien
            // ademas puede editarlas: son apuntes sobre la persona, no para la persona,
            // y mandarlas al navegador «por si acaso» ya seria filtrarlas.
            'notes' => ($mode === 'admin' || $permissions['canEditNotes']) ? $employee->notes : null,
            'account' => $this->account($employee),
            'lifecycle' => $this->lifecycle($employee),
            'metrics' => $this->metrics($employee, $period, $permissions['canViewSalary']),
            'alerts' => $this->alerts($employee, $permissions),
            'permissions' => $permissions,
            'requests' => $this->requests($employee, $permissions),
            'auditLog' => $permissions['canViewAudit'] ? $this->auditLog($employee) : [],
            'history' => $this->history($employee, $permissions['canViewSalary']),
            'options' => $this->options($employee, $permissions),
        ];
    }

    // ------------------------------------------------------------------ permisos

    /**
     * Objeto plano de booleanos. El cliente no decide nada: lee esto.
     *
     * @return array<string, bool>
     */
    public function permissions(Employee $employee, User $viewer): array
    {
        $isSelf = $viewer->employee_id !== null && (int) $viewer->employee_id === (int) $employee->id;

        return [
            'isSelf' => $isSelf,
            'canEditIdentity' => Gate::forUser($viewer)->allows('updateSection', [$employee, 'identity']),
            'canEditContact' => Gate::forUser($viewer)->allows('updateSection', [$employee, 'contact']),
            'canEditPayroll' => Gate::forUser($viewer)->allows('updateSection', [$employee, 'payroll']),
            'canEditBankAccount' => Gate::forUser($viewer)->allows('updateSection', [$employee, 'bank']),
            'canEditNotes' => Gate::forUser($viewer)->allows('updateSection', [$employee, 'notes']),
            'canEditOwnContact' => $isSelf,
            // Distingue «edito porque es mi ficha» de «edito porque administro fichas».
            // La pantalla lo necesita para decidir si muestra el documento y la fecha de
            // ingreso —datos del contrato— dentro de la sección de identidad, que es
            // exactamente la misma línea que traza `EmployeeSectionUpdater`.
            'canEditAsAdministrator' => $viewer->can('employees.profile.edit_section') || $viewer->isSuperAdmin(),
            'canViewSalary' => Gate::forUser($viewer)->allows('viewSalary', $employee),
            'canViewBankAccount' => Gate::forUser($viewer)->allows('viewBankAccount', $employee),
            'canViewAudit' => Gate::forUser($viewer)->allows('viewAudit', $employee),
            'canViewRequests' => Gate::forUser($viewer)->allows('viewRequests', $employee),
            'canCreateRequests' => Gate::forUser($viewer)->allows('createRequest', $employee),
            'canApproveRequests' => Gate::forUser($viewer)->allows('approveRequests', $employee),
            'canManageAccess' => Gate::forUser($viewer)->allows('manageAccess', $employee),
            'canManageLifecycle' => Gate::forUser($viewer)->allows('manageLifecycle', $employee),
            'canEditFullForm' => Gate::forUser($viewer)->allows('update', $employee),
            // Acciones de cuenta con su propio permiso granular, ya existentes en el modulo.
            'canCreateAccess' => $viewer->can('employees.access.create') || $viewer->isSuperAdmin(),
            'canResetPassword' => $viewer->can('employees.access.reset_password') || $viewer->isSuperAdmin(),
            'canChangeRole' => $viewer->can('employees.access.change_role') || $viewer->isSuperAdmin(),
            'canToggleAccess' => $viewer->can('employees.access.toggle') || $viewer->isSuperAdmin(),
        ];
    }

    // ------------------------------------------------------------------ bloques

    /** @return array<string, mixed> */
    protected function identity(Employee $employee): array
    {
        return [
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'full_name' => $employee->full_name,
            'initials' => $employee->initials,
            'document_type' => $employee->document_type,
            'document_number' => $employee->document_number,
            'hire_date' => $employee->hire_date?->toDateString(),
            'photo' => $this->media->url($employee->getAttributes()['photo'] ?? null),
            'is_active' => (bool) $employee->is_active,
            'company' => $employee->company ? ['id' => $employee->company->id, 'name' => $employee->company->name] : null,
        ];
    }

    /** @return array<string, mixed> */
    protected function contact(Employee $employee): array
    {
        return [
            'phone' => $employee->phone,
            'email' => $employee->email,
            'address' => $employee->address,
            'emergency_contact_name' => $employee->emergency_contact_name,
            'emergency_contact_phone' => $employee->emergency_contact_phone,
        ];
    }

    /**
     * Nomina. Sin permiso viaja `restricted: true` y ningun numero: no es que se oculte
     * en la pantalla, es que el dato no sale del servidor.
     *
     * @return array<string, mixed>
     */
    protected function payroll(Employee $employee, bool $canViewSalary): array
    {
        $mode = $employee->payroll_mode ?? Employee::PAYROLL_MODE_OPERATIONS;

        $common = [
            'payroll_mode' => $mode,
            'payroll_mode_label' => $this->payrollModeLabel($mode),
            'minutes_per_full_workday' => (int) ($employee->minutes_per_full_workday ?? 480),
            'ordinary_hours_per_day' => $employee->ordinary_hours_per_day !== null ? (float) $employee->ordinary_hours_per_day : null,
            'is_exempt_from_overtime' => (bool) $employee->is_exempt_from_overtime,
            'scheduled_work_days' => $employee->scheduled_work_days ?? [],
            'restricted' => ! $canViewSalary,
        ];

        if (! $canViewSalary) {
            return $common + ['base_salary' => null, 'daily_salary' => null];
        }

        return $common + [
            'base_salary' => (float) ($employee->base_salary ?? 0),
            'daily_salary' => $employee->daily_salary !== null ? (float) $employee->daily_salary : null,
        ];
    }

    /**
     * Datos de pago siempre enmascarados. `restricted` distingue «no tiene permiso» de
     * «no hay cuenta cargada», que en pantalla se leen muy distinto.
     *
     * @return array<string, mixed>
     */
    protected function bankAccount(Employee $employee, bool $canView): array
    {
        $bank = $employee->bank;

        if (! $canView) {
            return [
                'restricted' => true,
                'has_account' => $employee->bank_id !== null,
                'bank' => null,
                'account_type' => null,
                'account_masked' => null,
                'key_masked' => null,
            ];
        }

        $bankArray = $bank?->toArray() ?? [];

        return [
            'restricted' => false,
            'has_account' => $employee->bank_id !== null,
            'bank' => $bank ? [
                'id' => $bank->id,
                'name' => $bank->name,
                'code' => $bank->code,
                'is_active' => (bool) $bank->is_active,
                'logo_url' => $bankArray['logo_url'] ?? null,
                'initials' => $bankArray['initials'] ?? null,
                'brand_color' => $bank->brand_color,
                'type' => $bank->type,
            ] : null,
            'account_type' => $employee->bank_account_type,
            'account_masked' => $this->maskTail($employee->bank_account_number),
            'key_masked' => $this->maskTail($employee->bank_key),
        ];
    }

    /** @return array<string, mixed> */
    protected function account(Employee $employee): array
    {
        $user = $employee->user;

        if (! $user) {
            return [
                'exists' => false,
                'is_active' => false,
                'email' => null,
                'last_login_at' => null,
                'role' => null,
                'user_id' => null,
                'password_change_required' => false,
                'status_label' => 'Sin acceso',
            ];
        }

        $role = $user->roles->first();

        return [
            'exists' => true,
            'user_id' => $user->id,
            'is_active' => (bool) $user->is_active,
            'email' => $user->email,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'password_change_required' => (bool) $user->password_change_required,
            'role' => $role ? [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name ?? $role->name,
                'color' => $role->color ?? '#6366f1',
            ] : null,
            'status_label' => $user->is_active ? 'Activa' : 'Desactivada',
        ];
    }

    /**
     * Ciclo de vida y checklist de onboarding.
     *
     * Los pasos se calculan del estado real de los datos, no de una marca aparte: asi el
     * checklist no puede quedar diciendo «documentos al dia» de un empleado sin direccion.
     *
     * @return array<string, mixed>
     */
    protected function lifecycle(Employee $employee): array
    {
        $status = $employee->lifecycleStatus();

        $checklist = [
            [
                'key' => 'identity',
                'label' => 'Identidad y fecha de ingreso',
                'done' => $employee->document_number !== null && $employee->document_number !== '' && $employee->hire_date !== null,
            ],
            [
                'key' => 'contact',
                'label' => 'Dirección y contacto de emergencia',
                'done' => ! $this->isBlank($employee->address)
                    && ! $this->isBlank($employee->emergency_contact_name)
                    && ! $this->isBlank($employee->emergency_contact_phone),
            ],
            [
                'key' => 'bank',
                'label' => 'Datos para pago',
                'done' => $employee->bank_id !== null && ! $this->isBlank($employee->bank_account_number),
            ],
            [
                'key' => 'access',
                'label' => 'Cuenta de acceso activa',
                'done' => $employee->hasSystemAccess(),
            ],
        ];

        return [
            'status' => $status,
            'status_label' => $this->lifecycleLabel($status),
            'flow' => array_map(fn (string $step) => [
                'key' => $step,
                'label' => $this->lifecycleLabel($step),
            ], Employee::LIFECYCLE_FLOW),
            'checklist' => $checklist,
            'pending_steps' => count(array_filter($checklist, fn (array $step) => ! $step['done'])),
            'termination_date' => $employee->termination_date?->toDateString(),
            'termination_reason' => $employee->termination_reason,
        ];
    }

    // ------------------------------------------------------------------ metricas

    /**
     * Periodo vigente.
     *
     * Si hay una nomina abierta de la empresa que cubre hoy, manda esa: es el periodo con
     * el que se va a liquidar de verdad. Si no hay ninguna, se usa la quincena natural
     * (1–15 / 16–fin de mes), que es la periodicidad por defecto del producto.
     *
     * @return array{start: Carbon, end: Carbon, label: string, payroll_id: int|null}
     */
    public function currentPeriod(Employee $employee): array
    {
        $today = Carbon::today();

        $payroll = Payroll::query()
            ->withoutGlobalScopes()
            ->where('company_id', $employee->company_id)
            ->whereDate('period_start', '<=', $today->toDateString())
            ->whereDate('period_end', '>=', $today->toDateString())
            ->whereNull('deleted_at')
            ->orderByDesc('id')
            ->first(['id', 'name', 'period_start', 'period_end']);

        if ($payroll) {
            return [
                'start' => Carbon::parse($payroll->period_start)->startOfDay(),
                'end' => Carbon::parse($payroll->period_end)->endOfDay(),
                'label' => $payroll->name,
                'payroll_id' => (int) $payroll->id,
            ];
        }

        $isFirstHalf = $today->day <= 15;
        $start = $isFirstHalf ? $today->copy()->startOfMonth() : $today->copy()->startOfMonth()->addDays(15);
        $end = $isFirstHalf ? $today->copy()->startOfMonth()->addDays(14) : $today->copy()->endOfMonth();

        return [
            'start' => $start->startOfDay(),
            'end' => $end->endOfDay(),
            'label' => ($isFirstHalf ? 'Primera' : 'Segunda').' quincena de '.$this->monthName($today),
            'payroll_id' => null,
        ];
    }

    /**
     * Cifras de la quincena en curso.
     *
     * El neto es explicitamente un estimado y la pantalla lo dice: la nomina real aplica
     * deducciones legales, ajustes manuales y descuentos por inasistencia que no se pueden
     * anticipar aqui sin duplicar `PayrollCalculationService`. Lo que si es exacto es lo
     * producido y lo que ya se entrego como anticipo.
     *
     * @param  array{start: Carbon, end: Carbon, label: string, payroll_id: int|null}  $period
     * @return array<string, mixed>
     */
    protected function metrics(Employee $employee, array $period, bool $canViewSalary): array
    {
        $start = $period['start']->toDateString();
        $end = $period['end']->toDateString();

        $production = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$start, $end])
            ->whereNull('deleted_at')
            ->selectRaw('COALESCE(SUM(quantity), 0) as units, COALESCE(SUM(total_value), 0) as value, COUNT(DISTINCT date) as days')
            ->first();

        $units = (int) ($production->units ?? 0);
        $producedValue = (float) ($production->value ?? 0);
        $daysWithProduction = (int) ($production->days ?? 0);

        // Anticipos pendientes de descontar: es lo que se va a restar del proximo pago,
        // hayan sido entregados en este periodo o arrastren de uno anterior.
        $pendingAdvances = (float) Advance::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->where('status', Advance::STATUS_PENDING)
            ->sum('remaining_amount');

        $periodAdvances = (float) Advance::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$start, $end])
            ->sum('amount');

        $earned = $this->estimatedEarnings($employee, $period, $producedValue);
        $goal = $this->unitsGoal($employee, $period, $units);

        return [
            'period_label' => $period['label'],
            'period_start' => $start,
            'period_end' => $end,
            'payroll_id' => $period['payroll_id'],
            'units' => $units,
            'days_with_production' => $daysWithProduction,
            'units_goal' => $goal['value'],
            'units_goal_source' => $goal['source'],
            'units_progress' => $goal['value'] > 0 ? min(100, (int) round(($units / $goal['value']) * 100)) : null,
            'restricted' => ! $canViewSalary,
            'produced_value' => $canViewSalary ? round($producedValue, 2) : null,
            'earned_estimate' => $canViewSalary ? round($earned, 2) : null,
            'advances_period' => $canViewSalary ? round($periodAdvances, 2) : null,
            'advances_pending' => $canViewSalary ? round($pendingAdvances, 2) : null,
            'net_estimate' => $canViewSalary ? round(max($earned - $pendingAdvances, 0), 2) : null,
        ];
    }

    /**
     * Devengado estimado segun la modalidad. Para operaciones es lo producido; para las
     * modalidades por tiempo, el valor del dia por los dias con jornada cerrada.
     *
     * @param  array{start: Carbon, end: Carbon, label: string, payroll_id: int|null}  $period
     */
    protected function estimatedEarnings(Employee $employee, array $period, float $producedValue): float
    {
        if ($employee->isPayrollByOperations()) {
            return $producedValue;
        }

        $workedDays = WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereBetween('work_date', [$period['start']->toDateString(), $period['end']->toDateString()])
            ->whereIn('status', [WorkDaySession::STATUS_CLOSED, WorkDaySession::STATUS_ADJUSTED])
            ->distinct()
            ->count('work_date');

        if ($employee->isPayrollFixedDaily()) {
            return $workedDays * (float) ($employee->daily_salary ?? 0);
        }

        // Horas legales: el salario mensual se prorratea sobre los 30 dias del mes legal
        // colombiano. Es una aproximacion declarada, no la liquidacion.
        $dailyRate = ((float) ($employee->base_salary ?? 0)) / 30;

        return $workedDays * $dailyRate;
    }

    /**
     * Meta de unidades del periodo.
     *
     * Primero la que fije la empresa en ajustes. Si no hay ninguna, se compara contra el
     * periodo anterior de la misma duracion: una meta inventada seria peor que ninguna, y
     * «lo que hiciste la quincena pasada» es una referencia que el operario reconoce.
     *
     * @param  array{start: Carbon, end: Carbon, label: string, payroll_id: int|null}  $period
     * @return array{value: int, source: string}
     */
    protected function unitsGoal(Employee $employee, array $period, int $currentUnits): array
    {
        $configured = (int) (Setting::get(self::UNITS_GOAL_SETTING, 0, (int) $employee->company_id) ?: 0);

        if ($configured > 0) {
            return ['value' => $configured, 'source' => 'company'];
        }

        $length = max((int) floor($period['start']->diffInDays($period['end'])) + 1, 1);
        $previousEnd = $period['start']->copy()->subDay();
        $previousStart = $previousEnd->copy()->subDays($length - 1);

        $previousUnits = (int) Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$previousStart->toDateString(), $previousEnd->toDateString()])
            ->whereNull('deleted_at')
            ->sum('quantity');

        if ($previousUnits > 0) {
            return ['value' => $previousUnits, 'source' => 'previous_period'];
        }

        return ['value' => 0, 'source' => 'none'];
    }

    // ------------------------------------------------------------------ alertas

    /**
     * Alertas accionables. Se calculan de los datos vigentes en cada carga, asi que
     * desaparecen solas en cuanto su causa se resuelve: no hay estado que apagar.
     *
     * @param  array<string, bool>  $permissions
     * @return list<array<string, mixed>>
     */
    protected function alerts(Employee $employee, array $permissions): array
    {
        $alerts = [];

        if (! $employee->hasSystemAccess() && $permissions['canManageAccess']) {
            $alerts[] = [
                'key' => 'no_access',
                'tone' => 'warning',
                'label' => $employee->user_id
                    ? 'La cuenta de acceso está desactivada'
                    : 'Sin cuenta de acceso al sistema',
                'detail' => $employee->user_id
                    ? 'No puede ingresar mientras la cuenta siga desactivada.'
                    : 'No puede registrar su producción ni ver su desprendible.',
                'action' => $employee->user_id ? 'toggle_access' : 'create_access',
                'action_label' => $employee->user_id ? 'Activar acceso' : 'Crear acceso',
            ];
        }

        $missing = $this->missingRequiredFields($employee, $permissions);
        if ($missing !== []) {
            $alerts[] = [
                'key' => 'missing_data',
                'tone' => 'warning',
                'label' => 'Faltan datos obligatorios',
                'detail' => implode(', ', $missing).'.',
                'action' => 'complete_data',
                'action_label' => 'Completar',
            ];
        }

        if (! $employee->isTerminated() && $employee->is_active) {
            $days = $this->daysWithoutProduction($employee);
            if ($days !== null && $days >= self::PRODUCTION_SILENCE_DAYS) {
                $alerts[] = [
                    'key' => 'no_production',
                    'tone' => 'info',
                    'label' => 'Sin producción registrada en '.$days.' días',
                    'detail' => 'El último registro es del '.$this->lastProductionDate($employee).'.',
                    'action' => 'review_production',
                    'action_label' => 'Revisar',
                ];
            }
        }

        if ($permissions['canViewRequests']) {
            $pending = EmployeeRequest::query()
                ->withoutGlobalScopes()
                ->where('employee_id', $employee->id)
                ->where('status', EmployeeRequest::STATUS_PENDING)
                ->count();

            if ($pending > 0) {
                $alerts[] = [
                    'key' => 'pending_requests',
                    'tone' => 'accent',
                    'label' => $pending === 1 ? '1 solicitud pendiente' : $pending.' solicitudes pendientes',
                    'detail' => $permissions['canApproveRequests']
                        ? 'Están esperando tu aprobación.'
                        : 'Están en revisión.',
                    'action' => $permissions['canApproveRequests'] ? 'approve_requests' : 'view_requests',
                    'action_label' => $permissions['canApproveRequests'] ? 'Aprobar' : 'Ver',
                ];
            }
        }

        return $alerts;
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return list<string>
     */
    protected function missingRequiredFields(Employee $employee, array $permissions): array
    {
        $missing = [];

        if ($this->isBlank($employee->address)) {
            $missing[] = 'dirección';
        }

        if ($this->isBlank($employee->emergency_contact_name) || $this->isBlank($employee->emergency_contact_phone)) {
            $missing[] = 'contacto de emergencia';
        }

        // Quien no puede ver la cuenta bancaria tampoco recibe el aviso de que falta: no
        // podria resolverlo y solo seria ruido.
        if ($permissions['canViewBankAccount'] && ($employee->bank_id === null || $this->isBlank($employee->bank_account_number))) {
            $missing[] = 'cuenta bancaria';
        }

        return $missing;
    }

    protected function daysWithoutProduction(Employee $employee): ?int
    {
        if (! $employee->isPayrollByOperations()) {
            return null;
        }

        $last = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereNull('deleted_at')
            ->max('date');

        if ($last === null) {
            // Nunca produjo: solo se alerta si ya lleva tiempo contratado.
            $hired = $employee->hire_date ? Carbon::parse($employee->hire_date) : null;

            return $hired ? (int) $hired->diffInDays(Carbon::today()) : null;
        }

        return (int) Carbon::parse($last)->diffInDays(Carbon::today());
    }

    protected function lastProductionDate(Employee $employee): string
    {
        $last = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereNull('deleted_at')
            ->max('date');

        return $last ? Carbon::parse($last)->format('d/m/Y') : 'nunca';
    }

    // ------------------------------------------------------------------ solicitudes

    /**
     * @param  array<string, bool>  $permissions
     * @return array<string, mixed>
     */
    protected function requests(Employee $employee, array $permissions): array
    {
        if (! $permissions['canViewRequests']) {
            return ['mine' => [], 'pending' => [], 'can_approve' => false];
        }

        $rows = EmployeeRequest::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->with(['requester:id,name,last_name', 'reviewer:id,name,last_name'])
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        $mapped = $rows->map(fn (EmployeeRequest $row) => $this->mapRequest($row, $permissions))->values()->all();

        return [
            'mine' => $mapped,
            'pending' => array_values(array_filter($mapped, fn (array $row) => $row['status'] === EmployeeRequest::STATUS_PENDING)),
            'can_approve' => $permissions['canApproveRequests'],
        ];
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return array<string, mixed>
     */
    protected function mapRequest(EmployeeRequest $row, array $permissions): array
    {
        return [
            'id' => $row->id,
            'type' => $row->type,
            'type_label' => $row->typeLabel(),
            'status' => $row->status,
            'status_label' => match ($row->status) {
                EmployeeRequest::STATUS_APPROVED => 'Aprobada',
                EmployeeRequest::STATUS_REJECTED => 'Rechazada',
                default => 'En revisión',
            },
            'summary' => $this->requestSummary($row, $permissions),
            'created_at' => $row->created_at?->toIso8601String(),
            'reviewed_at' => $row->reviewed_at?->toIso8601String(),
            'reviewer' => $row->reviewer?->full_name,
            'requester' => $row->requester?->full_name,
            'rejection_reason' => $row->rejection_reason,
        ];
    }

    /**
     * Resumen legible de la solicitud, ya respetando permisos: un monto de anticipo no se
     * muestra a quien no puede ver el dinero del empleado.
     *
     * @param  array<string, bool>  $permissions
     */
    protected function requestSummary(EmployeeRequest $row, array $permissions): string
    {
        $payload = $row->payload ?? [];

        return match ($row->type) {
            EmployeeRequest::TYPE_ADVANCE => $permissions['canViewSalary']
                ? 'Anticipo de $ '.number_format((float) ($payload['amount'] ?? 0), 0, ',', '.').' — '.($payload['reason'] ?? 'sin motivo')
                : 'Anticipo solicitado — '.($payload['reason'] ?? 'sin motivo'),
            EmployeeRequest::TYPE_PROFILE_CHANGE => $permissions['canViewBankAccount']
                ? 'Nueva cuenta '.$this->maskTail($payload['bank_account_number'] ?? null).' · '.($payload['bank_name'] ?? 'banco por confirmar')
                : 'Cambio de cuenta bancaria (restringido)',
            EmployeeRequest::TYPE_PRODUCTION_CORRECTION => 'Registro del '.($payload['production_date'] ?? '—')
                .' · '.($payload['description'] ?? 'sin detalle'),
            default => '—',
        };
    }

    // ------------------------------------------------------------------ bitacora

    /** @return list<array<string, mixed>> */
    protected function auditLog(Employee $employee): array
    {
        return EmployeeAuditLog::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->orderByDesc('id')
            ->limit(60)
            ->get()
            ->map(fn (EmployeeAuditLog $row) => [
                'id' => $row->id,
                'event' => $row->event,
                'event_label' => $this->eventLabel($row->event),
                'field' => $row->field,
                'field_label' => EmployeeAuditLogger::labelFor($row->field),
                'old_value' => $row->old_value,
                'new_value' => $row->new_value,
                'actor' => $row->actor_name,
                'created_at' => $row->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    protected function eventLabel(string $event): string
    {
        return match ($event) {
            EmployeeAuditLog::EVENT_SECTION_UPDATED => 'Datos actualizados',
            EmployeeAuditLog::EVENT_ACCESS_CREATED => 'Acceso creado',
            EmployeeAuditLog::EVENT_ACCESS_TOGGLED => 'Acceso activado / desactivado',
            EmployeeAuditLog::EVENT_PASSWORD_RESET => 'Contraseña restablecida',
            EmployeeAuditLog::EVENT_ROLE_CHANGED => 'Rol cambiado',
            EmployeeAuditLog::EVENT_REQUEST_CREATED => 'Solicitud radicada',
            EmployeeAuditLog::EVENT_REQUEST_APPROVED => 'Solicitud aprobada',
            EmployeeAuditLog::EVENT_REQUEST_REJECTED => 'Solicitud rechazada',
            EmployeeAuditLog::EVENT_LIFECYCLE_CHANGED => 'Ciclo de vida',
            default => $event,
        };
    }

    // ------------------------------------------------------------------ historico

    /** @return array<string, mixed> */
    protected function history(Employee $employee, bool $canViewSalary): array
    {
        $productions = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereNull('deleted_at')
            ->with(['reference:id,code,name', 'operation:id,name'])
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(30)
            ->get()
            ->map(fn (Production $row) => [
                'id' => $row->id,
                'date' => $row->date?->toDateString(),
                'reference' => $row->reference ? trim($row->reference->code.' · '.$row->reference->name) : null,
                'operation' => $row->operation?->name,
                'quantity' => (int) $row->quantity,
                'status' => $row->status,
                'total_value' => $canViewSalary ? (float) $row->total_value : null,
            ])
            ->values()
            ->all();

        $payrolls = PayrollEmployee::query()
            ->where('employee_id', $employee->id)
            ->with('payroll:id,name,period_start,period_end,status,paid_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get()
            ->filter(fn (PayrollEmployee $row) => $row->payroll !== null)
            ->map(fn (PayrollEmployee $row) => [
                'id' => $row->id,
                'payroll_id' => $row->payroll_id,
                'name' => $row->payroll->name,
                'period_start' => $row->payroll->period_start?->toDateString(),
                'period_end' => $row->payroll->period_end?->toDateString(),
                'status' => $row->payroll->status,
                'is_paid' => (bool) $row->is_paid,
                'production_total' => $canViewSalary ? (float) $row->production_total : null,
                'advances_discount' => $canViewSalary ? (float) $row->advances_discount : null,
                'net_payment' => $canViewSalary ? (float) $row->net_payment : null,
                // El desprendible solo existe cuando la nomina ya se pago.
                'receipt_available' => $row->payroll->status === Payroll::STATUS_PAID,
            ])
            ->values()
            ->all();

        $advances = $canViewSalary
            ? Advance::query()
                ->withoutGlobalScopes()
                ->where('employee_id', $employee->id)
                ->orderByDesc('date')
                ->orderByDesc('id')
                ->limit(15)
                ->get()
                ->map(fn (Advance $row) => [
                    'id' => $row->id,
                    'date' => $row->date?->toDateString(),
                    'reason' => $row->reason,
                    'amount' => (float) $row->amount,
                    'remaining_amount' => (float) $row->remaining_amount,
                    'status' => $row->status,
                ])
                ->values()
                ->all()
            : [];

        return [
            'productions' => $productions,
            'payrolls' => $payrolls,
            'advances' => $advances,
        ];
    }

    // ------------------------------------------------------------------ opciones

    /**
     * Catalogos que necesitan los formularios de la ficha. Solo se cargan para quien
     * puede usarlos: a un operario no le viajan ni los roles ni los bancos de la empresa.
     *
     * @param  array<string, bool>  $permissions
     * @return array<string, mixed>
     */
    protected function options(Employee $employee, array $permissions): array
    {
        $roles = [];

        if ($permissions['canManageAccess'] || $permissions['canChangeRole'] || $permissions['canCreateAccess']) {
            $roles = Role::query()
                ->where('name', '!=', 'super_admin')
                ->where('company_id', $employee->company_id)
                ->with('company:id,name')
                ->orderBy('display_name')
                ->get(['id', 'name', 'display_name', 'description', 'color', 'is_system', 'company_id'])
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name ?? $role->name,
                    'color' => $role->color ?? '#6366f1',
                ])
                ->values()
                ->all();
        }

        $banks = [];

        if ($permissions['canEditBankAccount'] || $permissions['canCreateRequests']) {
            $banks = Bank::query()
                ->withoutGlobalScopes()
                ->where('company_id', $employee->company_id)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'is_active', 'logo_path', 'brand_color', 'type', 'requires_key', 'account_hint'])
                ->map(function (Bank $bank) {
                    $row = $bank->toArray();

                    return [
                        'id' => $bank->id,
                        'name' => $bank->name,
                        'code' => $bank->code,
                        'logo_url' => $row['logo_url'] ?? null,
                        'initials' => $row['initials'] ?? null,
                        'brand_color' => $bank->brand_color,
                        'type' => $bank->type,
                        'requires_key' => (bool) $bank->requires_key,
                        'account_hint' => $bank->account_hint,
                    ];
                })
                ->values()
                ->all();
        }

        return [
            'roles' => $roles,
            'banks' => $banks,
            'lifecycle_statuses' => array_map(fn (string $step) => [
                'value' => $step,
                'label' => $this->lifecycleLabel($step),
            ], Employee::LIFECYCLE_FLOW),
            'document_types' => ['CC', 'CE', 'TI', 'PAS', 'NIT'],
        ];
    }

    // ------------------------------------------------------------------ utilidades

    /** `•••• 4821`; null cuando no hay dato que enmascarar. */
    protected function maskTail(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        if (mb_strlen($value) <= 4) {
            return str_repeat('•', 4);
        }

        return '•••• '.mb_substr($value, -4);
    }

    protected function isBlank(?string $value): bool
    {
        return trim((string) $value) === '';
    }

    protected function payrollModeLabel(string $mode): string
    {
        return match ($mode) {
            Employee::PAYROLL_MODE_FIXED_DAILY => 'Salario diario fijo',
            Employee::PAYROLL_MODE_HOURLY_LEGAL => 'Por horas · legal',
            default => 'Por operaciones',
        };
    }

    protected function lifecycleLabel(string $status): string
    {
        return match ($status) {
            Employee::LIFECYCLE_HIRED => 'Contratado',
            Employee::LIFECYCLE_DOCUMENTS_OK => 'Documentos al día',
            Employee::LIFECYCLE_ACCESS_CREATED => 'Acceso creado',
            Employee::LIFECYCLE_TERMINATED => 'Retirado',
            default => 'Activo',
        };
    }

    protected function monthName(Carbon $date): string
    {
        $months = [
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril', 5 => 'mayo', 6 => 'junio',
            7 => 'julio', 8 => 'agosto', 9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
        ];

        return $months[$date->month] ?? '';
    }
}
