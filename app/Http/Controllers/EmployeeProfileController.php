<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Policies\EmployeePolicy;
use App\Services\Employee\EmployeeProfilePayload;
use App\Services\Employee\EmployeeSectionUpdater;
use App\Services\Payroll\PayrollReceiptPdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ficha 360 del empleado.
 *
 * Es la misma pantalla que `/profile`: lo unico que cambia es el modo con el que se monta
 * y los booleanos de `permissions`, que decide `EmployeePolicy`. Si esta clase empezara a
 * calcular algo que `ProfileController` no calcula, el modulo volveria a tener dos fichas.
 */
class EmployeeProfileController extends Controller
{
    public function __construct(
        protected EmployeeProfilePayload $payload,
        protected EmployeeSectionUpdater $sections,
    ) {}

    public function show(Request $request, Employee $employee): Response
    {
        $this->authorize('view', $employee);

        return Inertia::render('Employees/Show', [
            'profile' => $this->payload->build($employee, $request->user(), 'admin'),
        ]);
    }

    /**
     * Guardado parcial. Un fallo de validacion vuelve con los errores de esa seccion y no
     * toca nada de las demas: el formulario monolitico es justo lo que se elimino.
     */
    public function updateSection(Request $request, Employee $employee, string $section): RedirectResponse
    {
        abort_unless(in_array($section, EmployeePolicy::SECTIONS, true), 404);

        $this->authorize('updateSection', [$employee, $section]);

        $message = $this->sections->apply($request, $employee, $section, $request->user());

        return back()->with('success', $message);
    }

    /**
     * Desprendible del periodo.
     *
     * Reusa el PDF de `PayrollReceiptPdf`, el mismo que se envia por correo: dos
     * generadores del mismo documento acabarian mostrando cifras distintas.
     */
    public function receipt(Request $request, Employee $employee, PayrollEmployee $payrollEmployee): HttpResponse
    {
        $this->authorize('view', $employee);

        abort_unless((int) $payrollEmployee->employee_id === (int) $employee->id, 404);

        $payroll = Payroll::query()
            ->withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where('company_id', $employee->company_id)
            ->find($payrollEmployee->payroll_id);

        abort_unless($payroll !== null, 404);

        // Solo se entrega el desprendible de una nomina pagada: antes de eso las cifras
        // todavia se mueven y el documento no prueba nada.
        abort_unless($payroll->status === Payroll::STATUS_PAID, 404);

        $payrollEmployee->load(['employee', 'employee.bank:id,name,code', 'advances', 'adjustments.payrollConcept:id,name,code']);
        $payroll->load('company:id,name,nit,address,phone,logo');

        $pdf = app(PayrollReceiptPdf::class);

        return response($pdf->render($payroll, $payrollEmployee), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$pdf->filename($payroll, $payrollEmployee).'"',
        ]);
    }
}
