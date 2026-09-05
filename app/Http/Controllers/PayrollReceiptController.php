<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\SendPayrollReceiptsRequest;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Services\Payroll\PayrollReceiptPdf;
use App\Services\Payroll\PayrollReceiptSender;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Todo lo que rodea al comprobante de nomina como documento: enviarlo por correo y
 * entregarlo al empleado, que no tiene usuario en la plataforma.
 */
class PayrollReceiptController extends Controller
{
    public function __construct(
        private PayrollReceiptSender $sender,
        private PayrollReceiptPdf $pdf,
    ) {}

    /**
     * Envia el comprobante a los empleados seleccionados. Reenviar es valido y no se
     * bloquea: la pantalla muestra a quien ya se le mando para que sea una decision.
     */
    public function send(SendPayrollReceiptsRequest $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        abort_unless(
            $payroll->status === Payroll::STATUS_PAID,
            422,
            'Solo se envian comprobantes de una nomina pagada.',
        );

        // Las columnas van calificadas: el join con `employees` hace ambiguos `id` y `email`.
        $rows = PayrollEmployee::query()
            ->where('payroll_employees.payroll_id', $payroll->id)
            ->whereIn('payroll_employees.id', $request->validated('payroll_employee_ids'))
            ->with(['employee', 'employee.bank:id,name,code', 'advances', 'adjustments.payrollConcept:id,name,code'])
            ->join('employees', 'payroll_employees.employee_id', '=', 'employees.id')
            ->orderBy('employees.first_name')
            ->orderBy('employees.last_name')
            ->select('payroll_employees.*')
            ->get();

        if ($rows->isEmpty()) {
            return back()->with('error', 'Los empleados seleccionados no pertenecen a esta nomina.');
        }

        // Generar N PDF y hablar con el proveedor de correo desborda el limite por defecto
        // de PHP en una nomina grande; el envio es sincrono porque no hay worker de colas.
        @set_time_limit(0);

        $result = $this->sender->send($payroll, $rows);

        return back()->with($this->flashKey($result), $this->summary($result));
    }

    /**
     * PDF del comprobante para el empleado. La ruta va firmada y con caducidad: es el
     * unico permiso que existe aqui, porque quien abre el enlace no ha iniciado sesion.
     */
    public function publicPdf(Payroll $payroll, PayrollEmployee $payrollEmployee): Response
    {
        abort_unless((int) $payrollEmployee->payroll_id === (int) $payroll->id, 404);
        abort_unless($payroll->status === Payroll::STATUS_PAID, 404);

        $payrollEmployee->load(['employee', 'employee.bank:id,name,code', 'advances']);

        return response($this->pdf->render($payroll, $payrollEmployee), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$this->pdf->filename($payroll, $payrollEmployee).'"',
        ]);
    }

    /**
     * @param  array{sent: list<string>, skipped: list<array{name: string, reason: string}>, failed: list<array{name: string, reason: string}>}  $result
     */
    private function flashKey(array $result): string
    {
        if ($result['sent'] === []) {
            return 'error';
        }

        return $result['failed'] === [] && $result['skipped'] === [] ? 'success' : 'warning';
    }

    /**
     * Un resumen que diga exactamente que paso: «se enviaron 12» esconde a los 3 que no.
     *
     * @param  array{sent: list<string>, skipped: list<array{name: string, reason: string}>, failed: list<array{name: string, reason: string}>}  $result
     */
    private function summary(array $result): string
    {
        $parts = [];
        $sent = count($result['sent']);

        $parts[] = $sent === 0
            ? 'No se envio ningun comprobante.'
            : ($sent === 1 ? 'Se envio 1 comprobante.' : "Se enviaron {$sent} comprobantes.");

        if ($result['skipped'] !== []) {
            $names = implode(', ', array_column($result['skipped'], 'name'));
            $parts[] = 'Sin correo registrado: '.$names.'.';
        }

        if ($result['failed'] !== []) {
            $names = implode(', ', array_column($result['failed'], 'name'));
            $parts[] = 'Fallaron: '.$names.'. Revise el log para el detalle.';
        }

        return implode(' ', $parts);
    }

    private function ensurePayrollBelongsToActiveCompany(Request $request, Payroll $payroll): void
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            return;
        }

        $activeId = TenantContext::superAdminSelectedCompanyId();
        if ($activeId && (int) $activeId !== (int) $payroll->company_id) {
            abort(403, 'Esta nomina pertenece a otra empresa. Activa la empresa correcta en el selector.');
        }
    }
}
