<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreMembershipPlanRequest;
use App\Http\Requests\SuperAdmin\UpdateMembershipPlanRequest;
use App\Models\BillingCycle;
use App\Models\CompanyBillingCharge;
use App\Models\MembershipPlan;
use App\Services\Membership\MembershipPricing;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class MembershipPlanController extends Controller
{
    public function index(): Response
    {
        $plans = MembershipPlan::query()
            ->withCount('companies')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        $cycles = BillingCycle::query()->active()->ordered()->get();

        return Inertia::render('SuperAdmin/MembershipPlans/Index', [
            'plans' => $plans,
            // Lo que vale cada plan en cada periodo, calculado aqui y no en el navegador.
            'cyclePrices' => $plans->getCollection()->mapWithKeys(fn (MembershipPlan $plan) => [
                $plan->id => $cycles->map(fn (BillingCycle $cycle) => [
                    'cycle' => $cycle->name,
                    'months' => $cycle->months,
                    'discount_percent' => $cycle->discount_percent,
                    'price' => MembershipPricing::priceFor($plan, $cycle),
                ])->values()->all(),
            ])->all(),
            // El plan mas usado se destaca en la comparativa de tarjetas.
            'featuredPlanId' => $plans->getCollection()
                ->sortByDesc('companies_count')
                ->first(fn ($plan) => $plan->companies_count > 0)?->id,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('SuperAdmin/MembershipPlans/Create');
    }

    public function store(StoreMembershipPlanRequest $request): RedirectResponse
    {
        $data = $request->validated();
        if (! array_key_exists('is_active', $data)) {
            $data['is_active'] = true;
        } else {
            $data['is_active'] = (bool) $data['is_active'];
        }
        $data['sort_order'] = $data['sort_order'] ?? 0;
        $data['trial_days'] = (int) ($data['trial_days'] ?? 0);
        $data['is_featured'] = (bool) ($data['is_featured'] ?? false);

        MembershipPlan::create($data);

        return redirect()->route('super-admin.membership-plans.index')->with('success', 'Plan creado.');
    }

    public function edit(MembershipPlan $membership_plan): Response
    {
        return Inertia::render('SuperAdmin/MembershipPlans/Edit', [
            'plan' => $membership_plan,
        ]);
    }

    public function update(UpdateMembershipPlanRequest $request, MembershipPlan $membership_plan): RedirectResponse
    {
        $data = $request->validated();
        if (array_key_exists('is_active', $data)) {
            $data['is_active'] = (bool) $data['is_active'];
        }
        if (array_key_exists('trial_days', $data)) {
            $data['trial_days'] = (int) ($data['trial_days'] ?? 0);
        }
        if (array_key_exists('is_featured', $data)) {
            $data['is_featured'] = (bool) $data['is_featured'];
        }

        $membership_plan->update($data);

        return redirect()->route('super-admin.membership-plans.index')->with('success', 'Plan actualizado.');
    }

    /**
     * Borrar solo lo que nunca se uso. Con empresas o cobros se desactiva: borrarlo dejaba a
     * esas empresas sin plan (y sin limites) y a sus cobros sin saber que se pago.
     */
    public function destroy(MembershipPlan $membership_plan): RedirectResponse
    {
        if ($membership_plan->companies()->exists()
            || CompanyBillingCharge::query()->where('membership_plan_id', $membership_plan->id)->exists()) {
            return back()->with('error', 'Este plan tiene empresas o cobros: desactívalo en vez de borrarlo.');
        }

        $membership_plan->delete();

        return redirect()->route('super-admin.membership-plans.index')->with('success', 'Plan eliminado.');
    }
}
