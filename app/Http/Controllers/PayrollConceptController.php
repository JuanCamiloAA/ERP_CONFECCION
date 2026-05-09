<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayrollConcept\StorePayrollConceptRequest;
use App\Http\Requests\PayrollConcept\UpdatePayrollConceptRequest;
use App\Models\PayrollConcept;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PayrollConceptController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(PayrollConcept::class, 'payroll_concept');
    }

    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = PayrollConcept::query()
            ->with('company:id,name')
            ->withCount('adjustments');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $concepts = $query->orderBy('sort_order')->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('PayrollConcepts/Index', [
            'concepts' => $concepts,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('PayrollConcepts/Create');
    }

    public function store(StorePayrollConceptRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;
        PayrollConcept::create($data);

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto de nomina creado.');
    }

    public function edit(PayrollConcept $payrollConcept): Response
    {
        return Inertia::render('PayrollConcepts/Edit', [
            'concept' => $payrollConcept,
        ]);
    }

    public function update(UpdatePayrollConceptRequest $request, PayrollConcept $payrollConcept): RedirectResponse
    {
        $payrollConcept->update($request->validated());

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto actualizado.');
    }

    public function destroy(PayrollConcept $payrollConcept): RedirectResponse
    {
        if ($payrollConcept->adjustments()->exists()) {
            return redirect()->route('payroll-concepts.index')->with(
                'error',
                'No se puede eliminar: el concepto tiene ajustes en nominas. Desactivalo en su lugar.',
            );
        }

        $payrollConcept->delete();

        return redirect()->route('payroll-concepts.index')->with('success', 'Concepto eliminado.');
    }
}
