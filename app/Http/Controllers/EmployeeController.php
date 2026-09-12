<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Models\Bank;
use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\Production;
use App\Models\Role;
use App\Services\Employee\EmployeeAccessService;
use App\Services\Employee\EmployeeAuditLogger;
use App\Services\Files\StoredFileDeleter;
use App\Services\Membership\MembershipEmployeeLimiter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
        protected EmployeeAccessService $access,
        protected EmployeeAuditLogger $audit,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = Employee::query()->with([
            'user:id,email,is_active',
            // El listado muestra el rol con que entra cada persona, no un «tiene cuenta»:
            // saber que es «Operaria» o «Aux. contable» es justo lo que se va a buscar.
            'user.roles:id,name,display_name',
            'bank:id,name,code,is_active,logo_path,brand_color,type,requires_key',
            'company:id,name',
        ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('document_number', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Filtro por modalidad de pago: el listado ahora muestra esa columna, y quien
        // revisa jornadas o produccion necesita ver un grupo a la vez.
        $mode = (string) $request->input('mode', 'all');
        $modes = [
            Employee::PAYROLL_MODE_OPERATIONS,
            Employee::PAYROLL_MODE_FIXED_DAILY,
            Employee::PAYROLL_MODE_HOURLY_LEGAL,
        ];

        if (in_array($mode, $modes, true)) {
            $query->where('payroll_mode', $mode);
        } else {
            $mode = 'all';
        }

        $employees = $query->orderBy('first_name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Employees/Index', [
            'employees' => $employees,
            'filters' => ['search' => $search, 'status' => $status, 'mode' => $mode],
            'metrics' => $this->indexMetrics(),
        ]);
    }

    /**
     * Cifras de cabecera del listado.
     *
     * Se cuentan sobre toda la empresa, no sobre la pagina ni sobre el filtro: dos de
     * ellas son «Activos» e «Inactivos», y filtrarlas por el estado seleccionado las
     * dejaria siempre en cero. El conteo del resultado ya lo da la paginacion.
     *
     * Una sola consulta agregada: cuatro `count()` serian cuatro viajes a la base para
     * pintar una fila de tarjetas.
     *
     * @return array{active: int, with_access: int, missing_payment: int, inactive: int}
     */
    protected function indexMetrics(): array
    {
        $row = Employee::query()
            ->selectRaw('
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as with_access,
                SUM(CASE WHEN bank_id IS NULL
                          OR bank_account_number IS NULL OR bank_account_number = \'\'
                          OR bank_key IS NULL OR bank_key = \'\'
                     THEN 1 ELSE 0 END) as missing_payment
            ')
            ->first();

        return [
            'active' => (int) ($row->active ?? 0),
            'with_access' => (int) ($row->with_access ?? 0),
            'missing_payment' => (int) ($row->missing_payment ?? 0),
            'inactive' => (int) ($row->inactive ?? 0),
        ];
    }

    public function create(): Response
    {
        $roles = $this->companyRoles();

        return Inertia::render('Employees/Create', [
            'roles' => $roles,
            'banks' => $this->banksOptionsForEmployee(),
        ]);
    }

    public function store(StoreEmployeeRequest $request): RedirectResponse
    {
        $user = $request->user();

        return DB::transaction(function () use ($request, $user) {
            $data = $request->validated();
            $createUser = (bool) ($data['create_user_account'] ?? false);

            unset(
                $data['photo'],
                $data['create_user_account'],
                $data['user_email'],
                $data['user_role_id'],
                $data['password_mode'],
                $data['user_password'],
                $data['user_password_confirmation'],
                $data['require_password_change'],
            );

            $data['company_id'] = TenantContext::requireCompanyIdForWrite($user);
            $data['is_active'] = $data['is_active'] ?? true;

            $payrollMode = $data['payroll_mode'] ?? Employee::PAYROLL_MODE_OPERATIONS;

            app(MembershipEmployeeLimiter::class)->assertCanAddEmployee((int) $data['company_id'], $user);

            $employee = Employee::create([
                'company_id' => $data['company_id'],
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'document_type' => $data['document_type'],
                'document_number' => $data['document_number'],
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? null,
                'hire_date' => $data['hire_date'],
                'photo' => null,
                'base_salary' => $data['base_salary'] ?? 0,
                'payroll_mode' => $payrollMode,
                'daily_salary' => $payrollMode === Employee::PAYROLL_MODE_FIXED_DAILY ? ($data['daily_salary'] ?? 0) : null,
                'minutes_per_full_workday' => (int) ($data['minutes_per_full_workday'] ?? 480),
                'ordinary_hours_per_day' => $payrollMode === Employee::PAYROLL_MODE_HOURLY_LEGAL ? ($data['ordinary_hours_per_day'] ?? 8) : 8,
                'is_exempt_from_overtime' => (bool) ($data['is_exempt_from_overtime'] ?? false),
                'scheduled_work_days' => $data['scheduled_work_days'] ?? Employee::DEFAULT_SCHEDULED_WORK_DAYS,
                'bank_id' => $data['bank_id'] ?? null,
                'bank_account_number' => $data['bank_account_number'] ?? null,
                'bank_key' => $data['bank_key'] ?? null,
                'is_active' => $data['is_active'],
                'notes' => $data['notes'] ?? null,
            ]);

            if ($request->hasFile('photo')) {
                $uploaded = $this->objectStorage->upload(
                    $request->file('photo'),
                    "companies/{$employee->company_id}/employees/{$employee->id}"
                );
                $employee->update(['photo' => $uploaded['path']]);
            }

            $temporaryPassword = null;

            if ($createUser) {
                $account = $this->access->resolvePassword($request);
                $temporaryPassword = $account['reveal'] ? $account['plain'] : null;

                $this->access->createAccount(
                    $employee,
                    $request->validated('user_email'),
                    Role::find($request->validated('user_role_id')),
                    $account,
                    $user,
                );
            }

            return redirect()->route('employees.show', $employee)->with([
                'success' => 'Empleado creado correctamente.',
                'temporary_password' => $temporaryPassword,
            ]);
        });
    }

    /*
     * `show` vive ahora en `EmployeeProfileController`: la ficha de un empleado y «mi
     * perfil» son la misma pantalla, y armar su payload en dos controladores era lo que
     * las hacia divergir. La ruta `employees.show` y sus permisos no cambiaron.
     */

    public function edit(Employee $employee): Response
    {
        return Inertia::render('Employees/Edit', [
            // Los roles del usuario alimentan el estado de la cuenta en el panel lateral:
            // «Con acceso · Operaria» dice mas que un simple «tiene cuenta».
            'employee' => $employee->load(['user.roles', 'bank']),
            'roles' => $this->companyRoles($employee->company_id),
            'banks' => $this->banksOptionsForEmployee($employee),
            // Cambiar la modalidad de nomina de alguien que ya produjo afecta lo que se
            // le liquide de aqui en adelante; el formulario lo advierte antes de guardar.
            'hasProductions' => Production::query()
                ->withoutGlobalScopes()
                ->where('employee_id', $employee->id)
                ->exists(),
        ]);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee): RedirectResponse
    {
        $data = $request->validated();
        unset($data['photo']);
        $payrollMode = $data['payroll_mode'] ?? Employee::PAYROLL_MODE_OPERATIONS;
        $data['payroll_mode'] = $payrollMode;
        $data['daily_salary'] = $payrollMode === Employee::PAYROLL_MODE_FIXED_DAILY ? ($data['daily_salary'] ?? 0) : null;
        $data['minutes_per_full_workday'] = (int) ($data['minutes_per_full_workday'] ?? 480);
        $data['ordinary_hours_per_day'] = $payrollMode === Employee::PAYROLL_MODE_HOURLY_LEGAL ? ($data['ordinary_hours_per_day'] ?? 8) : 8;
        $data['is_exempt_from_overtime'] = (bool) ($data['is_exempt_from_overtime'] ?? false);
        $data['scheduled_work_days'] = $data['scheduled_work_days'] ?? Employee::DEFAULT_SCHEDULED_WORK_DAYS;

        if ($request->hasFile('photo')) {
            $this->storedFileDeleter->deleteIfPresent($employee->getAttributes()['photo'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('photo'),
                "companies/{$employee->company_id}/employees/{$employee->id}"
            );
            $data['photo'] = $uploaded['path'];
        }

        // El formulario completo tambien deja bitacora: si solo la dejara el guardado por
        // seccion, editar el salario desde aqui seria la via para que no quedara registro.
        $before = [];
        foreach (array_keys($data) as $field) {
            $before[$field] = $employee->getAttribute($field);
        }

        $employee->update($data);

        $this->audit->logChanges($employee, $before, $data, EmployeeAuditLog::EVENT_SECTION_UPDATED, $request->user());

        return redirect()->route('employees.show', $employee)->with('success', 'Empleado actualizado.');
    }

    public function deactivate(Employee $employee): RedirectResponse
    {
        if (! $employee->is_active) {
            return back()->with('warning', 'El empleado ya esta inactivo.');
        }

        $employee->update(['is_active' => false]);

        return back()->with('success', 'Empleado inactivado. Si tenia acceso al sistema, quedo deshabilitado.');
    }

    /**
     * Vuelve a activar a un empleado inactivado.
     *
     * Espejo exacto de deactivate(). Antes solo existia el camino de ida: para revertirlo
     * habia que abrir el formulario completo y guardar, con todo lo que eso puede tocar
     * de paso; desde el listado, reactivar es un solo campo.
     */
    public function reactivate(Employee $employee): RedirectResponse
    {
        if ($employee->is_active) {
            return back()->with('warning', 'El empleado ya esta activo.');
        }

        $employee->update(['is_active' => true]);

        return back()->with('success', 'Empleado reactivado.');
    }

    public function destroy(Employee $employee): RedirectResponse
    {
        $employee->is_active = false;
        $employee->save();

        $employee->delete();

        return redirect()->route('employees.index')->with('success', 'Empleado eliminado.');
    }

    /*
     * Las acciones de la cuenta de acceso (crear, activar/desactivar, cambiar rol y
     * restablecer contrasena) viven en `EmployeeAccessController`, sobre
     * `EmployeeAccessService`. Las rutas y los permisos son los mismos; lo que se gano es
     * que el alta de empleado y la ficha creen la cuenta con el mismo codigo, y que cada
     * accion deje su linea en la bitacora.
     */

    protected function companyRoles(?int $forCompanyId = null): Collection
    {
        $auth = auth()->user();
        $companyId = $forCompanyId ?? $auth?->company_id;

        if ($auth?->isSuperAdmin() && $forCompanyId === null) {
            $companyId = TenantContext::superAdminSelectedCompanyId();
        }

        $query = Role::query()->where('name', '!=', 'super_admin');

        if (! $auth?->isSuperAdmin()) {
            $query->where('company_id', $companyId);
        } elseif ($companyId) {
            $query->where('company_id', $companyId);
        } else {
            $query->whereRaw('1 = 0');
        }

        return $query
            ->with('company:id,name')
            ->orderBy('display_name')
            ->get(['id', 'name', 'display_name', 'description', 'color', 'is_system', 'company_id']);
    }

    /**
     * Bancos activos para el selector de datos de pago; en edición incluye el banco actual
     * aunque esté inactivo (histórico).
     *
     * Viajan también el logo y las reglas de cuenta de cada banco: el selector pinta el logo
     * y cambia el formato, la ayuda y la nota al elegir, sin una petición por banco.
     *
     * @return list<array<string, mixed>>
     */
    protected function banksOptionsForEmployee(?Employee $employee = null): array
    {
        $companyId = TenantContext::effectiveCompanyId(auth()->user());
        if (! $companyId) {
            return [];
        }

        $columns = [
            'id', 'name', 'code', 'is_active', 'logo_path', 'brand_color',
            'type', 'account_format', 'account_hint', 'requires_key', 'notes',
        ];

        $banks = Bank::query()
            ->where('is_active', true)
            ->withCount('employees')
            ->orderBy('name')
            ->get($columns);

        if ($employee?->bank_id) {
            $current = Bank::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('id', $employee->bank_id)
                ->withCount('employees')
                ->first($columns);
            if ($current && ! $banks->contains(fn ($b) => (int) $b->id === (int) $current->id)) {
                $banks->push($current);
                $banks = $banks->sortBy('name')->values();
            }
        }

        return $banks
            ->map(function (Bank $bank) {
                // `toArray` resuelve `logo_url` e `initials`; el resto se toma de ahi para no
                // duplicar la forma del payload en dos sitios.
                $row = $bank->toArray();

                return [
                    'id' => $bank->id,
                    // El sufijo «(inactivo)» solo aparece en el nombre del desplegable viejo;
                    // el selector nuevo usa `name` limpio y una insignia aparte.
                    'name' => $bank->is_active ? $bank->name : $bank->name.' (inactivo)',
                    'display_name' => $bank->name,
                    'code' => $bank->code,
                    'is_active' => (bool) $bank->is_active,
                    'logo_url' => $row['logo_url'] ?? null,
                    'initials' => $row['initials'] ?? '??',
                    'brand_color' => $bank->brand_color,
                    'type' => $bank->type,
                    'type_label' => $row['type_label'] ?? 'Banco',
                    'account_format' => $bank->account_format,
                    'account_hint' => $bank->account_hint,
                    'requires_key' => (bool) $bank->requires_key,
                    'notes' => $bank->notes,
                    'employees_count' => (int) ($bank->employees_count ?? 0),
                ];
            })
            ->values()
            ->all();
    }
}
