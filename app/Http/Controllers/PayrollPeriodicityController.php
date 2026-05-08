<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayrollPeriodicity\StorePayrollPeriodicityRequest;
use App\Http\Requests\PayrollPeriodicity\UpdatePayrollPeriodicityRequest;
use App\Models\Payroll;
use App\Models\PayrollPeriodicity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PayrollPeriodicityController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', PayrollPeriodicity::class);

        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = PayrollPeriodicity::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $rows = $query->withCount([
            'payrolls' => fn ($q) => $q->withoutGlobalScopes(),
        ])->ordered()->paginate(20)->withQueryString();

        return Inertia::render('PayrollPeriodicities/Index', [
            'periodicities' => $rows,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function create(): Response
    {
        $this->authorize('create', PayrollPeriodicity::class);

        return Inertia::render('PayrollPeriodicities/Create');
    }

    public function store(StorePayrollPeriodicityRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', true);
        $data['sort_order'] = $data['sort_order'] ?? 0;
        PayrollPeriodicity::create($data);

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad creada.');
    }

    public function edit(PayrollPeriodicity $payrollPeriodicity): Response
    {
        $this->authorize('update', $payrollPeriodicity);

        return Inertia::render('PayrollPeriodicities/Edit', [
            'periodicity' => $payrollPeriodicity,
        ]);
    }

    public function update(UpdatePayrollPeriodicityRequest $request, PayrollPeriodicity $payrollPeriodicity): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', $payrollPeriodicity->is_active);
        $payrollPeriodicity->update($data);

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad actualizada.');
    }

    public function destroy(PayrollPeriodicity $payrollPeriodicity): RedirectResponse
    {
        $this->authorize('delete', $payrollPeriodicity);

        $inUse = Payroll::query()
            ->withoutGlobalScopes()
            ->where('type', $payrollPeriodicity->code)
            ->exists();

        if ($inUse) {
            if ($payrollPeriodicity->is_active) {
                $payrollPeriodicity->update(['is_active' => false]);

                return back()->with('success', 'La periodicidad esta en uso; se desactivo en lugar de eliminar.');
            }

            return back()->with('error', 'No se puede eliminar: hay nominas con esta periodicidad.');
        }

        $payrollPeriodicity->delete();

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad eliminada.');
    }
}
