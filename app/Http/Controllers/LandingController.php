<?php

namespace App\Http\Controllers;

use App\Models\LandingBlock;
use App\Models\LandingGlobal;
use App\Models\LandingSection;
use App\Models\MembershipPlan;
use App\Services\Landing\LandingBlockMedia;
use App\Services\Landing\LandingDataSources;
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

        // Vista previa del borrador: solo para quien administra la landing (super usuario).
        $preview = $request->boolean('preview') && $user?->isSuperAdmin();

        // La landing por bloques manda en cuanto haya contenido publicado en landing_blocks.
        if (LandingBlock::query()->whereNotNull('published_data')->exists() || $preview) {
            return $this->renderBlocks($preview);
        }

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

    /**
     * Landing publica desde landing_blocks. En produccion sirve solo `published_data`;
     * con ?preview=1 (super usuario) sirve el borrador `data`.
     */
    private function renderBlocks(bool $preview): Response
    {
        $query = LandingBlock::query()->ordered();

        if (! $preview) {
            $query->where('is_visible', true)->whereNotNull('published_data');
        }

        $sources = app(LandingDataSources::class);
        $media = app(LandingBlockMedia::class);

        $blocks = $query->get()
            ->filter(fn (LandingBlock $b) => $preview ? $b->is_visible : true)
            ->map(function (LandingBlock $b) use ($preview, $sources, $media) {
                $data = ($preview ? $b->data : $b->published_data) ?? [];

                // Las imagenes se firman aqui: la URL caduca, la ruta no.
                $entry = ['type' => $b->type, 'data' => $media->present($b->type, (array) $data)];

                // Los bloques de datos se resuelven aqui: la pagina publica recibe filas
                // ya presentadas, nunca la definicion del origen ni la consulta.
                if ($b->type === 'data') {
                    $resolved = $sources->resolve($data);
                    $entry['rows'] = $resolved['rows'];
                    $entry['error'] = $preview ? $resolved['error'] : null;
                    unset($entry['data']['query']);
                }

                return $entry;
            })
            ->values()
            ->all();

        $global = LandingGlobal::instance();

        return Inertia::render('Public/Landing', [
            'blocks' => $blocks,
            'preview' => $preview,
            // Apariencia por defecto de cada tipo: lo que ve el visitante cuando el bloque
            // nunca paso por la pestana «Diseno» del editor.
            'appearanceDefaults' => collect(config('landing_blocks'))
                ->map(fn ($entry) => is_array($entry['appearance'] ?? null) ? $entry['appearance'] : [])
                ->all(),
            'meta' => [
                'title' => $global->meta_title ?: config('app.name'),
                'description' => $global->meta_description ?: '',
                'favicon_url' => null,
            ],
        ]);
    }
}
