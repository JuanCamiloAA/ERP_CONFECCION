<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayrollLegalParameter\StorePayrollLegalParameterRequest;
use App\Http\Requests\PayrollLegalParameter\UpdatePayrollLegalParameterRequest;
use App\Models\PayrollLegalParameter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PayrollLegalParameterController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(PayrollLegalParameter::class, 'payroll_legal_parameter');
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        $companyId = TenantContext::effectiveCompanyId($user);

        $parameters = PayrollLegalParameter::query()
            ->forCompany($companyId)
            ->orderByDesc('effective_from')
            ->get();

        return Inertia::render('PayrollLegalParameters/Index', [
            'parameters' => $parameters,
            'isSuperAdmin' => (bool) $user?->isSuperAdmin(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('PayrollLegalParameters/Create', [
            'isSuperAdmin' => (bool) $request->user()?->isSuperAdmin(),
        ]);
    }

    public function store(StorePayrollLegalParameterRequest $request): RedirectResponse
    {
        $data = $request->validated();
        unset($data['is_global']);
        $data['company_id'] = $request->targetCompanyId();
        $data['discount_unexcused_absences'] = $request->boolean('discount_unexcused_absences');

        PayrollLegalParameter::create($data);

        return redirect()->route('payroll-legal-parameters.index')->with('success', 'Tramo de parametros legales creado.');
    }

    public function edit(PayrollLegalParameter $payrollLegalParameter): Response
    {
        return Inertia::render('PayrollLegalParameters/Edit', [
            'parameter' => $payrollLegalParameter,
        ]);
    }

    public function update(UpdatePayrollLegalParameterRequest $request, PayrollLegalParameter $payrollLegalParameter): RedirectResponse
    {
        $data = $request->validated();
        $data['discount_unexcused_absences'] = $request->boolean('discount_unexcused_absences');

        $payrollLegalParameter->update($data);

        return redirect()->route('payroll-legal-parameters.index')->with('success', 'Tramo actualizado.');
    }

    public function destroy(PayrollLegalParameter $payrollLegalParameter): RedirectResponse
    {
        $hasApprovedPayrolls = \App\Models\Payroll::query()
            ->withoutGlobalScopes()
            ->when(
                $payrollLegalParameter->company_id !== null,
                fn ($q) => $q->where('company_id', $payrollLegalParameter->company_id)
            )
            ->whereIn('status', [\App\Models\Payroll::STATUS_APPROVED, \App\Models\Payroll::STATUS_PAID])
            ->where('period_start', '<=', $payrollLegalParameter->effective_to ?? '9999-12-31')
            ->where('period_end', '>=', $payrollLegalParameter->effective_from)
            ->exists();

        if ($hasApprovedPayrolls) {
            return back()->with(
                'error',
                'No se puede eliminar: hay nominas aprobadas o pagadas liquidadas dentro de este tramo. Cierre su vigencia (effective_to) y cree un tramo nuevo en su lugar.'
            );
        }

        $payrollLegalParameter->delete();

        return redirect()->route('payroll-legal-parameters.index')->with('success', 'Tramo eliminado.');
    }
}
