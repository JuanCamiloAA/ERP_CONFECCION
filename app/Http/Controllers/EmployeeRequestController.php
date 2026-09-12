<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Services\Employee\EmployeeRequestService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Solicitudes del empleado sobre su propia ficha.
 *
 * Crear no cambia ningun dato; aprobar si. Por eso las tres acciones tienen permisos
 * distintos: radicar es de quien la vive, revisar es de quien responde por ella.
 */
class EmployeeRequestController extends Controller
{
    public function __construct(protected EmployeeRequestService $requests) {}

    public function store(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('createRequest', $employee);

        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(EmployeeRequest::TYPES)],
            'payload' => ['required', 'array'],
        ]);

        $this->requests->create($employee, $validated['type'], $validated['payload'], $request->user());

        return back()->with('success', 'Solicitud enviada. Queda en revisión.');
    }

    public function approve(Request $request, EmployeeRequest $employeeRequest): RedirectResponse
    {
        $employee = $this->employeeFor($employeeRequest);

        $this->authorize('approveRequests', $employee);

        $message = $this->requests->approve($employeeRequest, $request->user());

        return back()->with('success', $message);
    }

    public function reject(Request $request, EmployeeRequest $employeeRequest): RedirectResponse
    {
        $employee = $this->employeeFor($employeeRequest);

        $this->authorize('approveRequests', $employee);

        // El motivo es obligatorio: un rechazo sin explicacion obliga al empleado a volver
        // a preguntar por fuera del sistema, que es lo que esta pantalla vino a evitar.
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'min:5', 'max:500'],
        ], [
            'rejection_reason.required' => 'Indica por qué se rechaza la solicitud.',
            'rejection_reason.min' => 'El motivo debe explicar la decisión.',
        ]);

        $this->requests->reject($employeeRequest, $request->user(), $validated['rejection_reason']);

        return back()->with('success', 'Solicitud rechazada.');
    }

    /**
     * El empleado de la solicitud, ya dentro del alcance de la empresa del usuario: el
     * `CompanyScope` de `Employee` devuelve null para una solicitud de otra empresa, y
     * ahi el 404 es la respuesta correcta.
     */
    protected function employeeFor(EmployeeRequest $employeeRequest): Employee
    {
        $employee = Employee::query()->find($employeeRequest->employee_id);

        abort_if($employee === null, 404);

        return $employee;
    }
}
