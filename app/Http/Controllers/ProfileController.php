<?php

namespace App\Http\Controllers;

use App\Http\Requests\Profile\ChangePasswordRequest;
use App\Http\Requests\Profile\UpdateAccountRequest;
use App\Models\Employee;
use App\Models\Scopes\CompanyScope;
use App\Services\Account\AccountPayload;
use App\Services\Employee\EmployeeProfilePayload;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(
        protected EmployeeProfilePayload $payload,
        protected AccountPayload $account,
    ) {}

    /**
     * «Mi perfil».
     *
     * Dos capas en una sola pantalla:
     *
     *  - `account` — identidad de la cuenta, seguridad, sesiones y preferencias. Lo tiene
     *    TODO el mundo, porque todo el mundo tiene una cuenta de acceso.
     *  - `profile` — la ficha de empleado en modo `self`, la misma que sirve
     *    `/employees/{employee}`. Solo existe para quien está vinculado a una ficha; una
     *    cuenta administrativa recibe `null` y la pantalla no dibuja producción ni nómina.
     *
     * Que las dos viajen juntas es lo que permite que un operario gestione su contraseña y
     * sus sesiones sin salir de su perfil, y que un administrador sin ficha siga teniendo
     * una pantalla con contenido.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->load('roles');
        $employee = $this->ownEmployee($request);

        return Inertia::render('Profile/Edit', [
            'user' => $user,
            'account' => $this->account->build($user, $request),
            'profile' => $employee ? $this->payload->build($employee, $user, 'self') : null,
        ]);
    }

    /**
     * Guarda identidad y preferencias.
     *
     * Nunca correo, contraseña, rol ni estado: cada uno tiene su ruta con reautenticación
     * o permiso propio (ver `UpdateAccountRequest`). La foto tampoco, porque obligaría a
     * enviar todo el formulario como multipart en cada cambio de nombre.
     */
    public function update(UpdateAccountRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $user->forceFill([
            'name' => $data['name'],
            'last_name' => $data['last_name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'notification_preferences' => $request->preferences(),
        ])->save();

        // La ficha de empleado lleva el mismo nombre y el mismo teléfono: sin propagarlo,
        // el empleado se corrige el nombre aquí y el listado sigue mostrando el anterior.
        $this->syncEmployee($user);

        return back()->with('success', 'Perfil actualizado.');
    }

    protected function syncEmployee($user): void
    {
        if (! $user->employee_id) {
            return;
        }

        $employee = Employee::withoutGlobalScope(CompanyScope::class)->find($user->employee_id);

        if (! $employee) {
            return;
        }

        $employee->forceFill([
            'first_name' => $user->name,
            'last_name' => $user->last_name ?: $employee->last_name,
            'phone' => $user->phone,
        ])->save();
    }

    public function showChangePassword(): Response
    {
        return Inertia::render('Profile/ChangePassword');
    }

    /**
     * Cambio obligatorio en el primer ingreso (middleware `force.password`).
     *
     * Sella `password_changed_at` igual que el cambio voluntario: es la columna de la que
     * sale la antigüedad en «Mi perfil», y un camino que no la escriba haría que la
     * pantalla mienta sobre una contraseña recién puesta.
     */
    public function changePassword(ChangePasswordRequest $request): RedirectResponse
    {
        $user = $request->user();

        $user->forceFill([
            'password' => Hash::make($request->input('password')),
            'password_change_required' => false,
            'password_changed_at' => now(),
        ])->save();

        return redirect()->route('dashboard')->with('success', 'Contrasena actualizada.');
    }

    /**
     * Ficha del usuario autenticado.
     *
     * Se salta el `CompanyScope` a proposito: un super admin con el selector puesto en
     * otra empresa seguiria siendo el mismo empleado, y el alcance no debe impedirle ver
     * su propio perfil. Aun asi se comprueba que la ficha sea suya y de su empresa.
     */
    protected function ownEmployee(Request $request): ?Employee
    {
        $user = $request->user();

        if (! $user->employee_id) {
            return null;
        }

        $employee = Employee::withoutGlobalScope(CompanyScope::class)->find($user->employee_id);

        if (! $employee) {
            return null;
        }

        if ($user->company_id !== null && (int) $employee->company_id !== (int) $user->company_id) {
            return null;
        }

        return $employee;
    }
}
