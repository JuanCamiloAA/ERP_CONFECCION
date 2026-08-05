<?php

namespace App\Http\Controllers;

use App\Http\Requests\Operation\StoreOperationRequest;
use App\Http\Requests\Operation\UpdateOperationRequest;
use App\Models\Company;
use App\Models\Operation;
use App\Support\OperationDifficulty;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
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

    public function store(StoreOperationRequest $request): RedirectResponse|JsonResponse
    {
        $data = $request->validated();
        $data['company_id'] = TenantContext::requireCompanyIdForWrite($request->user());
        $data['is_active'] = $data['is_active'] ?? true;

        $thresholds = OperationDifficulty::thresholdsFor(Company::find($data['company_id']));
        $data['difficulty_level'] = OperationDifficulty::levelFromMinutes((float) $data['estimated_minutes'], $thresholds);

        $operation = Operation::create($data);

        if ($request->wantsJson()) {
            return response()->json($operation);
        }

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
        $data = $request->validated();

        $thresholds = OperationDifficulty::thresholdsFor($operation->company);
        $data['difficulty_level'] = OperationDifficulty::levelFromMinutes((float) $data['estimated_minutes'], $thresholds);

        $operation->update($data);

        return redirect()->route('operations.index')->with('success', 'Operacion actualizada.');
    }

    public function destroy(Operation $operation): RedirectResponse
    {
        $operation->delete();

        return redirect()->route('operations.index')->with('success', 'Operacion eliminada.');
    }
}
