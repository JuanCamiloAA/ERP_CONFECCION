<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\Employee;
use App\Models\EmployeeAuditLog;
use App\Models\Scopes\CompanyScope;
use App\Services\Employee\EmployeeAuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Vincular la cuenta con una ficha de empleado.
 *
 * Reclamar una ficha da acceso a su nómina, su salario y su cuenta bancaria, así que no es
 * autoservicio: se exige poder administrar empleados de la empresa (`employees.index.edit`)
 * y la ficha tiene que ser de la misma empresa y no tener ya otra cuenta. Queda constancia
 * en la bitácora del empleado y en el registro de accesos.
 */
class EmployeeLinkController extends Controller
{
    public function __construct(protected EmployeeAuditLogger $audit) {}

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless(
            $user->isSuperAdmin() || $user->can('employees.index.edit'),
            403,
            'No tienes permiso para vincular tu cuenta a una ficha de empleado.',
        );

        if ($user->employee_id) {
            return back()->with('warning', 'Tu cuenta ya está vinculada a una ficha.');
        }

        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
        ], [
            'employee_id.required' => 'Selecciona la ficha que te corresponde.',
        ]);

        $employee = Employee::withoutGlobalScope(CompanyScope::class)->find($data['employee_id']);

        if (! $employee || (int) $employee->company_id !== (int) $user->company_id) {
            throw ValidationException::withMessages([
                'employee_id' => 'Esa ficha no pertenece a tu empresa.',
            ]);
        }

        if ($employee->user_id !== null) {
            throw ValidationException::withMessages([
                'employee_id' => 'Esa ficha ya tiene una cuenta de acceso.',
            ]);
        }

        // Los dos lados del vínculo se escriben juntos: una ficha apuntando a un usuario
        // que no le apunta de vuelta rompe tanto el perfil como el listado de empleados.
        DB::transaction(function () use ($user, $employee) {
            $user->forceFill(['employee_id' => $employee->id])->save();
            $employee->forceFill(['user_id' => $user->id])->save();
        });

        $this->audit->log(
            $employee,
            EmployeeAuditLog::EVENT_ACCESS_CREATED,
            'access',
            null,
            'Cuenta existente vinculada: '.$user->email,
            $user,
        );

        AccessLog::log('profile_employee_linked', $user->id);

        return back()->with('success', 'Tu cuenta quedó vinculada a la ficha de '.$employee->full_name.'.');
    }
}
