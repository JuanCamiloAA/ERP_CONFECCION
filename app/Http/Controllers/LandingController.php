<?php

namespace App\Http\Controllers;

use App\Models\LandingGlobal;
use App\Models\LandingSection;
use App\Models\MembershipPlan;
use App\Services\Landing\LandingPayloadPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LandingController extends Controller
{
    public function show(Request $request, LandingPayloadPresenter $presenter): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user && ! $user->isSuperAdmin()) {
            return redirect()->route('dashboard');
        }

        LandingSection::ensureSystemSectionsExist();

        $sections = LandingSection::query()
            ->where('status', LandingSection::STATUS_LIVE)
            ->whereNotNull('live_payload')
            ->orderBy('sort_order')
            ->get();

        $presentedSections = $sections->map(function (LandingSection $section) use ($presenter) {
            $live = $section->live_payload;
            if ($section->slug === 'partners') {
                $live = $presenter->mergePartnerCompaniesFromMaster(is_array($live) ? $live : null);
            }

            $payload = $presenter->presentPayload(is_array($live) ? $live : null);

            if ($section->slug === 'membership_plans') {
                $payload = is_array($payload) ? $payload : [];
                $payload['plans'] = MembershipPlan::query()
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->get()
                    ->map(fn (MembershipPlan $plan) => [
                        'id' => $plan->id,
                        'name' => $plan->name,
                        'slug' => $plan->slug,
                        'max_staff_users' => $plan->max_staff_users,
                        'max_employees' => $plan->max_employees,
                        'features_json' => $plan->features_json ?? [],
                        'price_monthly' => $plan->price_monthly !== null ? (float) $plan->price_monthly : null,
                    ])
                    ->values()
                    ->all();
            }

            return [
                'slug' => $section->slug,
                'title_internal' => $section->title_internal,
                'sort_order' => $section->sort_order,
                'payload' => $payload,
            ];
        })->values()->all();

        $global = LandingGlobal::instance();
        $presentedGlobals = $presenter->presentGlobals($global);

        return Inertia::render('Landing/Public', [
            'globals' => $presentedGlobals,
            'sections' => $presentedSections,
            'appName' => config('app.name'),
        ]);
    }
}
