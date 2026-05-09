<?php

namespace App\Http\Controllers;

use App\Http\Requests\Landing\StoreLandingPlanInquiryRequest;
use App\Mail\LandingPlanInquiryMail;
use App\Models\LandingGlobal;
use App\Models\MembershipPlan;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;

class LandingPlanInquiryController extends Controller
{
    public function __invoke(StoreLandingPlanInquiryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $plan = null;
        if (! empty($data['membership_plan_id'])) {
            $plan = MembershipPlan::query()
                ->where('is_active', true)
                ->find((int) $data['membership_plan_id']);
        }

        $recipients = $this->notificationRecipients();
        if ($recipients->isEmpty()) {
            return back()->with('error', 'No se pudo enviar la solicitud: no hay correos de destino configurados para super administradores.');
        }

        Mail::to($recipients->all())->send(new LandingPlanInquiryMail($data, $plan));

        return back()->with('success', 'Su solicitud fue enviada. Nos pondremos en contacto pronto.');
    }

    /**
     * @return Collection<int, string>
     */
    protected function notificationRecipients(): Collection
    {
        $override = LandingGlobal::instance()->plan_inquiry_notify_email;
        if (is_string($override) && $override !== '') {
            return collect([$override])->filter()->unique()->values();
        }

        return User::query()
            ->role('super_admin')
            ->where('is_active', true)
            ->pluck('email')
            ->filter()
            ->unique()
            ->values();
    }
}
