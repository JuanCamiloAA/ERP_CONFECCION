<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreMembershipPlanRequest;
use App\Http\Requests\SuperAdmin\UpdateMembershipPlanRequest;
use App\Models\MembershipPlan;
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

        return Inertia::render('SuperAdmin/MembershipPlans/Index', [
            'plans' => $plans,
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

        $membership_plan->update($data);

        return redirect()->route('super-admin.membership-plans.index')->with('success', 'Plan actualizado.');
    }

    public function destroy(MembershipPlan $membership_plan): RedirectResponse
    {
        $membership_plan->delete();

        return redirect()->route('super-admin.membership-plans.index')->with('success', 'Plan eliminado.');
    }
}
