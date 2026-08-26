<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayrollLegalParameter\StorePayrollLegalParameterRequest;
use App\Http\Requests\PayrollLegalParameter\UpdatePayrollLegalParameterRequest;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\PayrollLegalParameter;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

        $active = $this->activeParameter($parameters);

        return Inertia::render('PayrollLegalParameters/Index', [
            'parameters' => $parameters->map(fn (PayrollLegalParameter $p) => $this->toRow($p, $active))->values(),
            // El tramo que rige hoy: es la pregunta que la pantalla vieja no respondia.
            'active' => $active ? $this->toRow($active, $active) : null,
            'isSuperAdmin' => (bool) $user?->isSuperAdmin(),
            'salaryExample' => $this->salaryExample(),
        ]);
    }

    /**
     * Tramo que rige hoy: de los que cubren la fecha, gana el de la empresa sobre el global.
     *
     * Es la misma regla que aplica el calculo de nomina; exponerla es el punto de la
     * pantalla, asi que se resuelve aqui y no en el front.
     *
     * @param  Collection<int, PayrollLegalParameter>  $parameters
     */
    protected function activeParameter($parameters): ?PayrollLegalParameter
    {
        $today = now()->toDateString();

        $covering = $parameters->filter(function (PayrollLegalParameter $p) use ($today) {
            $from = $p->effective_from?->toDateString();
            $to = $p->effective_to?->toDateString();

            return $from !== null && $from <= $today && ($to === null || $to >= $today);
        });

        return $covering->firstWhere(fn (PayrollLegalParameter $p) => $p->company_id !== null)
            ?? $covering->first();
    }

    /**
     * @return array<string, mixed>
     */
    protected function toRow(PayrollLegalParameter $parameter, ?PayrollLegalParameter $active): array
    {
        return [
            'id' => $parameter->id,
            'company_id' => $parameter->company_id,
            'scope' => $parameter->company_id === null ? 'global' : 'company',
            'is_active' => $active !== null && $active->id === $parameter->id,
            'effective_from' => $parameter->effective_from?->toDateString(),
            'effective_to' => $parameter->effective_to?->toDateString(),
            'weekly_legal_hours' => (float) $parameter->weekly_legal_hours,
            'monthly_hours_divisor' => (float) $parameter->monthly_hours_divisor,
            'night_start_time' => substr((string) $parameter->night_start_time, 0, 5),
            'night_end_time' => substr((string) $parameter->night_end_time, 0, 5),
            'night_surcharge_percent' => (float) $parameter->night_surcharge_percent,
            'overtime_day_percent' => (float) $parameter->overtime_day_percent,
            'overtime_night_percent' => (float) $parameter->overtime_night_percent,
            'sunday_holiday_surcharge_percent' => (float) $parameter->sunday_holiday_surcharge_percent,
            'max_overtime_hours_per_day' => (float) $parameter->max_overtime_hours_per_day,
            'max_overtime_hours_per_week' => (float) $parameter->max_overtime_hours_per_week,
            'discount_unexcused_absences' => (bool) $parameter->discount_unexcused_absences,
            'absence_discount_percent' => (float) $parameter->absence_discount_percent,
            'legal_reference' => $parameter->legal_reference,
        ];
    }

    /**
     * Salario de referencia con el que la pantalla traduce los porcentajes a pesos.
     *
     * Se usa el promedio real de los empleados activos y no un minimo legal escrito a
     * mano: una cifra de ley que nadie de la empresa gana no ayuda a auditar el tramo. El
     * usuario puede cambiarlo en la simulacion.
     */
    protected function salaryExample(): float
    {
        $average = Employee::query()->active()->avg('base_salary');

        if ($average === null || (float) $average <= 0) {
            return 1500000.0;
        }

        // Redondeado al millar: es un ejemplo, no una liquidacion.
        return (float) (round((float) $average / 1000) * 1000);
    }

    public function create(Request $request): Response
    {
        $companyId = TenantContext::effectiveCompanyId($request->user());
        $parameters = PayrollLegalParameter::query()->forCompany($companyId)->orderByDesc('effective_from')->get();
        $active = $this->activeParameter($parameters);

        return Inertia::render('PayrollLegalParameters/Create', [
            'isSuperAdmin' => (bool) $request->user()?->isSuperAdmin(),
            'active' => $active ? $this->toRow($active, $active) : null,
            'salaryExample' => $this->salaryExample(),
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

    public function edit(Request $request, PayrollLegalParameter $payrollLegalParameter): Response
    {
        $companyId = TenantContext::effectiveCompanyId($request->user());
        $parameters = PayrollLegalParameter::query()->forCompany($companyId)->orderByDesc('effective_from')->get();
        $active = $this->activeParameter($parameters);

        return Inertia::render('PayrollLegalParameters/Edit', [
            'parameter' => $this->toRow($payrollLegalParameter, $active),
            'active' => $active ? $this->toRow($active, $active) : null,
            'salaryExample' => $this->salaryExample(),
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
        $hasApprovedPayrolls = Payroll::query()
            ->withoutGlobalScopes()
            ->when(
                $payrollLegalParameter->company_id !== null,
                fn ($q) => $q->where('company_id', $payrollLegalParameter->company_id)
            )
            ->whereIn('status', [Payroll::STATUS_APPROVED, Payroll::STATUS_PAID])
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
