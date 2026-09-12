<?php

namespace App\Http\Controllers;

use App\Http\Requests\Employee\StoreEmployeeAccessRequest;
use App\Models\Employee;
use App\Models\Role;
use App\Services\Employee\EmployeeAccessService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Cuenta de acceso del empleado.
 *
 * Antes vivia como una pestaña aislada de la ficha; ahora se dispara desde la alerta de
 * «sin acceso» y desde el bloque «Cuenta de acceso», pero las rutas y sus permisos son
 * los mismos de siempre —lo unico que cambio es que cada accion deja bitacora.
 */
class EmployeeAccessController extends Controller
{
    public function __construct(protected EmployeeAccessService $access) {}

    public function store(StoreEmployeeAccessRequest $request, Employee $employee): RedirectResponse
    {
        $this->authorize('manageAccess', $employee);

        if ($employee->user_id) {
            return back()->with('error', 'Este empleado ya tiene una cuenta de usuario.');
        }

        $data = $request->validated();
        $role = Role::find($data['role_id']);

        if ($reason = $this->access->roleRejectionReason($role, $employee, $request->user())) {
            return back()->with('error', $reason);
        }

        $password = $this->access->resolvePassword($request);

        $this->access->createAccount($employee, $data['email'], $role, $password, $request->user());

        return back()->with([
            'success' => 'Acceso creado correctamente.',
            'temporary_password' => $password['reveal'] ? $password['plain'] : null,
        ]);
    }

    public function toggle(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('manageAccess', $employee);

        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $isActive = $this->access->toggle($employee, $request->user());

        return back()->with('success', $isActive ? 'Acceso activado.' : 'Acceso desactivado.');
    }

    public function changeRole(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('manageAccess', $employee);

        $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $role = Role::find($request->input('role_id'));

        if ($reason = $this->access->roleRejectionReason($role, $employee, $request->user())) {
            return back()->with('error', $reason);
        }

        $employee->loadMissing('user.roles');
        $this->access->changeRole($employee, $role, $request->user());

        return back()->with('success', 'Rol actualizado.');
    }

    public function resetPassword(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('manageAccess', $employee);

        if (! $employee->user_id) {
            return back()->with('error', 'Este empleado no tiene cuenta de usuario.');
        }

        $temporary = $this->access->resetPassword(
            $employee,
            $request->boolean('require_password_change', true),
            $request->user(),
        );

        return back()->with([
            'success' => 'Contrasena restablecida.',
            'temporary_password' => $temporary,
        ]);
    }
}
