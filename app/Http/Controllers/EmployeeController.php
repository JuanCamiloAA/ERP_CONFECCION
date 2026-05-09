<?php

namespace App\Http\Controllers;

use App\Contracts\ObjectStorageInterface;
use App\Http\Requests\Employee\StoreEmployeeAccessRequest;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Models\Bank;
use App\Models\Employee;
use App\Models\Production;
use App\Models\Role;
use App\Models\User;
use App\Services\Files\StoredFileDeleter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function __construct(
        protected ObjectStorageInterface $objectStorage,
        protected StoredFileDeleter $storedFileDeleter,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = Employee::query()->with([
            'user:id,email,is_active',
            'bank:id,name,is_active',
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

        $employees = $query->orderBy('first_name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Employees/Index', [
            'employees' => $employees,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
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

            unset($data['photo'], $data['create_user_account'], $data['user_email'], $data['user_role_id']);

            $data['company_id'] = $user->company_id;
            $data['is_active'] = $data['is_active'] ?? true;

            $payrollMode = $data['payroll_mode'] ?? Employee::PAYROLL_MODE_OPERATIONS;

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
                $temporaryPassword = $this->generateTemporaryPassword();
                $newUser = User::create([
                    'company_id' => $employee->company_id,
                    'employee_id' => $employee->id,
                    'name' => $employee->first_name,
                    'last_name' => $employee->last_name,
                    'email' => $request->validated('user_email'),
                    'password' => Hash::make($temporaryPassword),
                    'phone' => $employee->phone,
                    'is_active' => true,
                    'password_change_required' => true,
                ]);

                $role = Role::find($request->validated('user_role_id'));
                if ($role) {
                    $newUser->assignRole($role);
                }

                $employee->user_id = $newUser->id;
                $employee->save();
            }

            return redirect()->route('employees.show', $employee)->with([
                'success' => 'Empleado creado correctamente.',
                'temporary_password' => $temporaryPassword,
            ]);
        });
    }

    public function show(Employee $employee): Response
    {
        $employee->load(['user.roles', 'bank']);

        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        $productions = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->with(['reference:id,code,name', 'operation:id,name'])
            ->orderByDesc('date')
            ->limit(50)
            ->get();

        $monthSummary = Production::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->selectRaw('SUM(quantity) as total_quantity, SUM(total_value) as total_value, COUNT(DISTINCT date) as days_worked')
            ->first();

        $advances = $employee->advances()->orderByDesc('date')->limit(20)->get();
        $payrolls = $employee->payrollEmployees()->with('payroll:id,name,period_start,period_end,status,paid_at')->orderByDesc('id')->limit(20)->get();

        return Inertia::render('Employees/Show', [
            'employee' => $employee,
            'productions' => $productions,
            'monthSummary' => [
                'total_quantity' => (int) ($monthSummary->total_quantity ?? 0),
                'total_value' => (float) ($monthSummary->total_value ?? 0),
                'days_worked' => (int) ($monthSummary->days_worked ?? 0),
            ],
            'advances' => $advances,
            'payrolls' => $payrolls,
            'roles' => $this->companyRoles($employee->company_id),
        ]);
    }

    public function edit(Employee $employee): Response
    {
        return Inertia::render('Employees/Edit', [
            'employee' => $employee->load(['user', 'bank']),
            'roles' => $this->companyRoles($employee->company_id),
            'banks' => $this->banksOptionsForEmployee($employee),
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

        if ($request->hasFile('photo')) {
            $this->storedFileDeleter->deleteIfPresent($employee->getAttributes()['photo'] ?? null);
            $uploaded = $this->objectStorage->upload(
                $request->file('photo'),
                "companies/{$employee->company_id}/employees/{$employee->id}"
            );
            $data['photo'] = $uploaded['path'];
        }

        $employee->update($data);

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

    public function destroy(Employee $employee): RedirectResponse
    {
        $employee->is_active = false;
        $employee->save();

        $employee->delete();

        return redirect()->route('employees.index')->with('success', 'Empleado eliminado.');
    }

    public function storeAccess(StoreEmployeeAccessRequest $request, Employee $employee): RedirectResponse
    {
        if ($employee->user_id) {
            return back()->with('error', 'Este empleado ya tiene una cuenta de usuario.');
        }

        $data = $request->validated();
        $temporaryPassword = $this->generateTemporaryPassword();

        $newUser = User::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'email' => $data['email'],
            'password' => Hash::make($temporaryPassword),
            'phone' => $employee->phone,
            'is_active' => true,
            'password_change_required' => true,
        ]);

        $role = Role::find($data['role_id']);
        if ($role) {
            $auth = $request->user();
            if ($role->name === 'super_admin' && ! $auth->isSuperAdmin()) {
                return back()->with('error', 'Rol no permitido.');
            }
            if ($role->company_id === null && ! $auth->isSuperAdmin()) {
                return back()->with('error', 'Rol no valido para esta empresa.');
            }
            if ($role->company_id !== null && (int) $role->company_id !== (int) $employee->company_id) {
                return back()->with('error', 'El rol no pertenece a la empresa del empleado.');
            }
            $newUser->assignRole($role);
        }

        $employee->user_id = $newUser->id;
        $employee->save();

        return back()->with([
            'success' => 'Acceso creado correctamente.',
            'temporary_password' => $temporaryPassword,
        ]);
    }

    public function toggleAccess(Employee $employee): RedirectResponse
    {
        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $employee->user->is_active = ! $employee->user->is_active;
        $employee->user->save();

        $msg = $employee->user->is_active ? 'Acceso activado.' : 'Acceso desactivado.';

        return back()->with('success', $msg);
    }

    public function changeRole(Request $request, Employee $employee): RedirectResponse
    {
        $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $role = Role::find($request->input('role_id'));
        if (! $role) {
            return back()->with('error', 'Rol no encontrado.');
        }

        $auth = $request->user();
        if ($role->name === 'super_admin' && ! $auth->isSuperAdmin()) {
            return back()->with('error', 'Rol no permitido.');
        }
        if ($role->company_id === null && ! $auth->isSuperAdmin()) {
            return back()->with('error', 'Rol no valido.');
        }
        if ($role->company_id !== null && (int) $role->company_id !== (int) $employee->company_id) {
            return back()->with('error', 'El rol no pertenece a la empresa del empleado.');
        }

        $employee->user->syncRoles([$role]);

        return back()->with('success', 'Rol actualizado.');
    }

    public function resetPassword(Employee $employee): RedirectResponse
    {
        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $temporaryPassword = $this->generateTemporaryPassword();
        $employee->user->password = Hash::make($temporaryPassword);
        $employee->user->password_change_required = true;
        $employee->user->save();

        return back()->with([
            'success' => 'Contrasena restablecida.',
            'temporary_password' => $temporaryPassword,
        ]);
    }

    protected function companyRoles(?int $forCompanyId = null): Collection
    {
        $auth = auth()->user();
        $companyId = $forCompanyId ?? $auth?->company_id;

        if ($auth?->isSuperAdmin() && $forCompanyId === null) {
            $companyId = session('active_company_id');
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
     * Bancos activos para selects; en edición incluye el banco actual aunque esté inactivo (histórico).
     *
     * @return list<array{id: int, name: string, is_active: bool}>
     */
    protected function banksOptionsForEmployee(?Employee $employee = null): array
    {
        $companyId = auth()->user()?->company_id;
        if (! $companyId) {
            return [];
        }

        $banks = Bank::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'is_active']);

        if ($employee?->bank_id) {
            $current = Bank::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('id', $employee->bank_id)
                ->first(['id', 'name', 'is_active']);
            if ($current && ! $banks->contains(fn ($b) => (int) $b->id === (int) $current->id)) {
                $banks->push($current);
                $banks = $banks->sortBy('name')->values();
            }
        }

        return $banks
            ->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->is_active ? $b->name : $b->name.' (inactivo)',
                'is_active' => (bool) $b->is_active,
            ])
            ->values()
            ->all();
    }

    protected function generateTemporaryPassword(): string
    {
        $upper = Str::upper(Str::random(2));
        $lower = Str::lower(Str::random(4));
        $number = (string) random_int(100, 999);
        $special = collect(['#', '@', '$', '%', '!', '&'])->random();

        return $upper.$lower.$number.$special;
    }
}
