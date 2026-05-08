<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\CalculatePayrollRequest;
use App\Http\Requests\Payroll\StorePayrollRequest;
use App\Models\Company;
use App\Models\Payroll;
use App\Models\PayrollPeriodicity;
use App\Models\Production;
use App\Models\WorkDaySession;
use App\Services\PayrollCalculationService;
use App\Support\CompanyContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PayrollController extends Controller
{
    public function __construct(protected PayrollCalculationService $calculator) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $status = $request->input('status', 'all');
        $year = (int) $request->input('year', now()->year);
        $companyId = CompanyContext::id($user);

        $query = Payroll::query()->withCount('payrollEmployees');

        if ($companyId) {
            $query->where('company_id', $companyId);
        } elseif ($user->isSuperAdmin()) {
            $query->whereRaw('1 = 0');
        }

        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if ($year) {
            $query->whereYear('period_start', $year);
        }

        if ($user->isEmployee() && ! $user->isAdmin()) {
            $query->whereHas('payrollEmployees', fn ($q) => $q->where('employee_id', $user->employee_id));
        }

        $payrolls = $query->orderByDesc('period_start')->paginate(15)->withQueryString();

        return Inertia::render('Payrolls/Index', [
            'payrolls' => $payrolls,
            'filters' => ['status' => $status, 'year' => $year],
        ]);
    }

    public function create(Request $request): Response
    {
        $companyId = CompanyContext::id($request->user());
        $company = $companyId ? Company::query()->find($companyId) : null;
        $storedCode = (string) ($company?->settings['payroll_periodicity'] ?? '');
        $default = PayrollPeriodicity::query()
            ->where('code', $storedCode !== '' ? $storedCode : 'quincenal')
            ->where('is_active', true)
            ->value('code');

        if ($default === null) {
            $default = PayrollPeriodicity::query()->active()->ordered()->value('code') ?? 'quincenal';
        }

        return Inertia::render('Payrolls/Create', [
            'defaultPayrollType' => $default,
        ]);
    }

    public function store(StorePayrollRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $companyId = CompanyContext::id($user);
        if (! $companyId) {
            return back()->with('error', 'Selecciona una empresa activa antes de crear una nomina.');
        }

        $payroll = Payroll::create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'period_start' => $data['period_start'],
            'period_end' => $data['period_end'],
            'type' => $data['type'],
            'status' => Payroll::STATUS_DRAFT,
            'total_amount' => 0,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return redirect()->route('payrolls.show', $payroll)->with('success', 'Nomina creada en borrador.');
    }

    public function show(Request $request, Payroll $payroll): Response
    {
        $user = $request->user();
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        $payroll->load([
            'payrollEmployees.employee:id,first_name,last_name,document_number,payroll_mode,daily_salary,minutes_per_full_workday',
            'payrollEmployees.advances',
        ]);

        $workSessionsByEmployee = WorkDaySession::query()
            ->withoutGlobalScopes()
            ->where('company_id', $payroll->company_id)
            ->whereBetween('work_date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->orderBy('work_date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($s) => (string) $s->employee_id)
            ->map(fn ($sessions) => $sessions->values()->all())
            ->all();

        $productionsByEmployee = Production::query()
            ->withoutGlobalScopes()
            ->with(['reference:id,code,name', 'operation:id,name'])
            ->whereBetween('date', [
                $payroll->period_start->format('Y-m-d'),
                $payroll->period_end->format('Y-m-d'),
            ])
            ->whereIn('status', [Production::STATUS_CONFIRMED, Production::STATUS_PENDING])
            ->where(function ($q) use ($payroll) {
                $cid = (int) $payroll->company_id;
                $q->where('company_id', $cid)
                    ->orWhereHas('reference', fn ($r) => $r->where('company_id', $cid));
            })
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($p) => (string) $p->employee_id)
            ->map(fn ($rows) => $rows->values()->all())
            ->all();

        if ($user->isEmployee() && ! $user->isAdmin()) {
            $payroll->setRelation(
                'payrollEmployees',
                $payroll->payrollEmployees->where('employee_id', $user->employee_id)->values()
            );
            $eid = (string) $user->employee_id;
            $workSessionsByEmployee = array_key_exists($eid, $workSessionsByEmployee)
                ? [$eid => $workSessionsByEmployee[$eid]]
                : [];
            $productionsByEmployee = array_key_exists($eid, $productionsByEmployee)
                ? [$eid => $productionsByEmployee[$eid]]
                : [];
        }

        return Inertia::render('Payrolls/Show', [
            'payroll' => $payroll,
            'workSessionsByEmployee' => $workSessionsByEmployee,
            'productionsByEmployee' => $productionsByEmployee,
        ]);
    }

    public function calculate(CalculatePayrollRequest $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('calculate', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        if (! $payroll->canBeCalculated()) {
            return back()->with('error', 'Esta nomina no puede ser calculada en su estado actual.');
        }

        $request->validated();

        $this->calculator->calculate(
            $payroll,
            $request->input('employee_adjustments'),
            $request->user()
        );

        return back()->with('success', 'Nomina calculada.');
    }

    public function approve(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('approve', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        try {
            $this->calculator->approve($payroll);
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Nomina aprobada.');
    }

    public function pay(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('pay', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        try {
            $this->calculator->markAsPaid($payroll);
        } catch (\DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Nomina marcada como pagada.');
    }

    public function destroy(Request $request, Payroll $payroll): RedirectResponse
    {
        $this->authorize('delete', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        if (! $payroll->isEditable()) {
            return back()->with('error', 'Solo se pueden eliminar nominas en borrador o calculadas.');
        }

        $payroll->payrollEmployees()->delete();
        $payroll->delete();

        return redirect()->route('payrolls.index')->with('success', 'Nomina eliminada.');
    }

    public function export(Request $request, Payroll $payroll): Response
    {
        $this->authorize('view', $payroll);
        $this->ensurePayrollBelongsToActiveCompany($request, $payroll);

        $payroll->load([
            'company:id,name,nit,address,phone',
            'payrollEmployees.employee:id,first_name,last_name,document_number,payroll_mode',
        ]);

        return Inertia::render('Payrolls/Print', [
            'payroll' => $payroll,
        ]);
    }

    protected function ensurePayrollBelongsToActiveCompany(Request $request, Payroll $payroll): void
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            return;
        }

        $activeId = session('active_company_id');
        if ($activeId && (int) $activeId !== (int) $payroll->company_id) {
            abort(403, 'Esta nomina pertenece a otra empresa. Activa la empresa correcta en el selector.');
        }
    }
}
