<?php

namespace App\Http\Controllers;

use App\Http\Requests\Bank\StoreBankRequest;
use App\Http\Requests\Bank\UpdateBankRequest;
use App\Models\Bank;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BankController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = Bank::query()->withCount('employees');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $banks = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Banks/Index', [
            'banks' => $banks,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Banks/Create');
    }

    public function store(StoreBankRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = $request->user()->company_id;
        $data['is_active'] = $data['is_active'] ?? true;

        Bank::create($data);

        return redirect()->route('banks.index')->with('success', 'Banco creado.');
    }

    public function edit(Bank $bank): Response
    {
        return Inertia::render('Banks/Edit', [
            'bank' => $bank,
        ]);
    }

    public function update(UpdateBankRequest $request, Bank $bank): RedirectResponse
    {
        $bank->update($request->validated());

        return redirect()->route('banks.index')->with('success', 'Banco actualizado.');
    }

    /**
     * Si hay empleados con este banco, se desactiva en lugar de borrar para mantener histórico.
     * Sin empleados vinculados: soft delete normal.
     */
    public function destroy(Bank $bank): RedirectResponse
    {
        if ($bank->employees()->exists()) {
            if ($bank->is_active) {
                $bank->update(['is_active' => false]);

                return redirect()->route('banks.index')->with(
                    'success',
                    'Banco desactivado: hay empleados que lo usan. Sigue visible en sus registros aunque no aparezca en nuevos formularios.',
                );
            }

            return redirect()->route('banks.index')->with(
                'warning',
                'No se puede eliminar: hay empleados vinculados y el banco ya estaba inactivo.',
            );
        }

        $bank->delete();

        return redirect()->route('banks.index')->with('success', 'Banco eliminado.');
    }
}
