<?php

namespace App\Http\Controllers;

use App\Http\Requests\Operation\StoreOperationRequest;
use App\Http\Requests\Operation\UpdateOperationRequest;
use App\Models\Operation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OperationController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $query = Operation::query()->withCount('references')->withCount('productions');

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        $operations = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('Operations/Index', [
            'operations' => $operations,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Operations/Create');
    }

    public function store(StoreOperationRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['company_id'] = $request->user()->company_id;
        $data['is_active'] = $data['is_active'] ?? true;

        Operation::create($data);

        return redirect()->route('operations.index')->with('success', 'Operacion creada.');
    }

    public function edit(Operation $operation): Response
    {
        return Inertia::render('Operations/Edit', [
            'operation' => $operation,
        ]);
    }

    public function update(UpdateOperationRequest $request, Operation $operation): RedirectResponse
    {
        $operation->update($request->validated());

        return redirect()->route('operations.index')->with('success', 'Operacion actualizada.');
    }

    public function destroy(Operation $operation): RedirectResponse
    {
        $operation->delete();

        return redirect()->route('operations.index')->with('success', 'Operacion eliminada.');
    }
}
