<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\SaveBillingCycleRequest;
use App\Models\BillingCycle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Periodos de pago de la membresia: cuantos meses cubre cada cobro y que descuento lleva.
 *
 * No se borran: un periodo con empresas o cobros es historia. Se desactivan, y siempre queda
 * al menos uno activo, porque sin periodos nadie podria renovar.
 */
class BillingCycleController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('SuperAdmin/BillingCycles/Index', [
            'cycles' => BillingCycle::query()
                ->ordered()
                ->withCount('companies')
                ->get()
                ->map(fn (BillingCycle $cycle) => [
                    'id' => $cycle->id,
                    'name' => $cycle->name,
                    'code' => $cycle->code,
                    'months' => $cycle->months,
                    'discount_percent' => $cycle->discount_percent,
                    'is_active' => $cycle->is_active,
                    'sort_order' => $cycle->sort_order,
                    'companies_count' => $cycle->companies_count,
                ])->values(),
        ]);
    }

    public function store(SaveBillingCycleRequest $request): RedirectResponse
    {
        $cycle = BillingCycle::query()->create($request->validated());

        return back()->with('success', "El periodo {$cycle->name} quedó creado.");
    }

    public function update(SaveBillingCycleRequest $request, BillingCycle $billingCycle): RedirectResponse
    {
        $data = $request->validated();

        if ($billingCycle->is_active && ! $data['is_active']) {
            $this->assertNotLastActive($billingCycle);
        }

        $billingCycle->update($data);

        return back()->with('success', "El periodo {$billingCycle->name} quedó guardado.");
    }

    public function toggle(BillingCycle $billingCycle): RedirectResponse
    {
        if ($billingCycle->is_active && ! BillingCycle::query()->active()->whereKeyNot($billingCycle->id)->exists()) {
            return back()->with('error', 'Es el único periodo activo: sin periodos nadie podría renovar.');
        }

        $billingCycle->update(['is_active' => ! $billingCycle->is_active]);

        return back()->with('success', $billingCycle->is_active
            ? "{$billingCycle->name} quedó activo."
            : "{$billingCycle->name} quedó desactivado. Las empresas que lo tienen lo conservan.");
    }

    protected function assertNotLastActive(BillingCycle $cycle): void
    {
        if (! BillingCycle::query()->active()->whereKeyNot($cycle->id)->exists()) {
            throw ValidationException::withMessages([
                'is_active' => 'Es el único periodo activo: sin periodos nadie podría renovar.',
            ]);
        }
    }
}
