<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\StorePayrollEmployeeAdjustmentRequest;
use App\Http\Requests\Payroll\UpdatePayrollEmployeeAdjustmentRequest;
use App\Models\Payroll;
use App\Models\PayrollEmployee;
use App\Models\PayrollEmployeeAdjustment;
use App\Services\PayrollCalculationService;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PayrollEmployeeAdjustmentController extends Controller
{
    public function __construct(protected PayrollCalculationService $calculator) {}

    public function store(
        Request $request,
        Payroll $payroll,
        PayrollEmployee $payrollEmployee,
        StorePayrollEmployeeAdjustmentRequest $adjustmentRequest,
    ): RedirectResponse {
        $this->authorizePayrollAndAdjustmentAccess($request, $payroll, $payrollEmployee);

        $data = $adjustmentRequest->validated();

        PayrollEmployeeAdjustment::create([
            'company_id' => $payroll->company_id,
            'payroll_employee_id' => $payrollEmployee->id,
            'payroll_concept_id' => (int) $data['payroll_concept_id'],
            'amount' => $data['amount'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        $this->calculator->recalculatePayrollEmployeeTotals($payrollEmployee);
        $this->calculator->refreshPayrollTotal($payroll);

        return back()->with('success', 'Ajuste registrado.');
    }

    public function update(
        Request $request,
        Payroll $payroll,
        PayrollEmployee $payrollEmployee,
        PayrollEmployeeAdjustment $adjustment,
        UpdatePayrollEmployeeAdjustmentRequest $adjustmentRequest,
    ): RedirectResponse {
        $this->authorizePayrollAndAdjustmentAccess($request, $payroll, $payrollEmployee);
        $this->ensureAdjustmentMatches($payroll, $payrollEmployee, $adjustment);

        $adjustment->update($adjustmentRequest->validated());

        $this->calculator->recalculatePayrollEmployeeTotals($payrollEmployee);
        $this->calculator->refreshPayrollTotal($payroll);

        return back()->with('success', 'Ajuste actualizado.');
    }

    public function destroy(
        Request $request,
        Payroll $payroll,
        PayrollEmployee $payrollEmployee,
        PayrollEmployeeAdjustment $adjustment,
    ): RedirectResponse {
        $this->authorizePayrollAndAdjustmentAccess($request, $payroll, $payrollEmployee);
        $this->ensureAdjustmentMatches($payroll, $payrollEmployee, $adjustment);

        $adjustment->delete();

        $this->calculator->recalculatePayrollEmployeeTotals($payrollEmployee);
        $this->calculator->refreshPayrollTotal($payroll);

        return back()->with('success', 'Ajuste eliminado.');
    }

    protected function authorizePayrollAndAdjustmentAccess(Request $request, Payroll $payroll, PayrollEmployee $payrollEmployee): void
    {
        $this->authorize('view', $payroll);

        $user = $request->user();
        if ($user?->isSuperAdmin()) {
            $activeId = TenantContext::superAdminSelectedCompanyId();
            if ($activeId && (int) $activeId !== (int) $payroll->company_id) {
                abort(403, 'Esta nomina pertenece a otra empresa. Activa la empresa correcta en el selector.');
            }
        }

        if ($user?->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            abort(403, 'En vista consolidada no se pueden editar nominas por empresa.');
        }

        abort_unless($payroll->allowsCalculatedPayrollEdits(), 403, 'Solo se pueden registrar ajustes cuando la nomina esta en estado calculado.');
        abort_if(! $user?->can('payrolls.show.manage_adjustments'), 403);

        abort_unless($payrollEmployee->payroll_id === $payroll->id, 404);
    }

    protected function ensureAdjustmentMatches(Payroll $payroll, PayrollEmployee $payrollEmployee, PayrollEmployeeAdjustment $adjustment): void
    {
        abort_unless(
            (int) $adjustment->payroll_employee_id === (int) $payrollEmployee->id
                && (int) $adjustment->company_id === (int) $payroll->company_id,
            404,
        );
    }
}
