<?php

namespace App\Http\Controllers;

use App\Http\Requests\Advance\StoreAdvanceRequest;
use App\Models\Advance;
use App\Models\Employee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdvanceController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->input('status', 'all');
        $employeeId = $request->input('employee_id');

        $query = Advance::query()->with('employee:id,first_name,last_name,document_number');

        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        $advances = $query->orderByDesc('date')->paginate(15)->withQueryString();

        return Inertia::render('Advances/Index', [
            'advances' => $advances,
            'filters' => ['status' => $status, 'employee_id' => $employeeId],
            'employees' => Employee::active()->orderBy('first_name')->get(['id', 'first_name', 'last_name']),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Advances/Create', [
            'employees' => Employee::active()->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'document_number']),
        ]);
    }

    public function store(StoreAdvanceRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        Advance::create([
            'company_id' => $user->company_id,
            'employee_id' => $data['employee_id'],
            'amount' => $data['amount'],
            'date' => $data['date'],
            'reason' => $data['reason'],
            'status' => Advance::STATUS_PENDING,
            'created_by' => $user->id,
        ]);

        return redirect()->route('advances.index')->with('success', 'Anticipo registrado.');
    }

    public function destroy(Advance $advance): RedirectResponse
    {
        if ($advance->status === Advance::STATUS_DISCOUNTED) {
            return back()->with('error', 'No se puede eliminar un anticipo ya descontado en nomina.');
        }

        $advance->delete();

        return redirect()->route('advances.index')->with('success', 'Anticipo eliminado.');
    }
}
