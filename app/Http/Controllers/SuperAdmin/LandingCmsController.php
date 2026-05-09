<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\Landing\StoreLandingCustomSectionRequest;
use App\Http\Requests\SuperAdmin\Landing\StoreLandingMediaRequest;
use App\Http\Requests\SuperAdmin\Landing\UpdateLandingGlobalsRequest;
use App\Http\Requests\SuperAdmin\Landing\UpdateLandingSectionRequest;
use App\Models\Company;
use App\Models\LandingGlobal;
use App\Models\LandingSection;
use App\Services\Files\MediaUrlResolver;
use App\Support\LandingDefaultPayloads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class LandingCmsController extends Controller
{
    public function index(): Response
    {
        LandingSection::ensureSystemSectionsExist();

        $sections = LandingSection::query()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (LandingSection $s) => [
                'slug' => $s->slug,
                'title_internal' => $s->title_internal,
                'sort_order' => $s->sort_order,
                'status' => $s->status,
                'is_system' => $s->is_system,
                'published_at' => $s->published_at?->toIso8601String(),
                'draft_payload' => $s->draft_payload,
                'live_payload' => $s->live_payload,
            ])
            ->all();

        $global = LandingGlobal::instance();

        $resolver = app(MediaUrlResolver::class);

        $companiesForPartners = Company::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'logo'])
            ->map(fn (Company $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'logo_url' => $resolver->url($c->getAttributes()['logo'] ?? null),
            ])
            ->values()
            ->all();

        return Inertia::render('SuperAdmin/Landing/Editor', [
            'sections' => $sections,
            'companiesForPartners' => $companiesForPartners,
            'globals' => $global->only([
                'site_name',
                'meta_title',
                'meta_description',
                'og_image_path',
                'header_logo_path',
                'favicon_path',
                'footer_privacy_url',
                'footer_terms_url',
                'footer_contact_url',
                'navbar_cta_text',
                'navbar_cta_url',
                'plan_inquiry_notify_email',
                'footer_legal_text',
            ]),
        ]);
    }

    public function updateSection(UpdateLandingSectionRequest $request, LandingSection $landingSection): RedirectResponse
    {
        $landingSection->update([
            'draft_payload' => $request->validated()['draft_payload'],
            'status' => LandingSection::STATUS_DRAFT,
        ]);

        return back()->with('success', 'Borrador guardado.');
    }

    public function publishSection(LandingSection $landingSection): RedirectResponse
    {
        $draft = $landingSection->draft_payload;
        if ($draft === null) {
            return back()->with('warning', 'No hay borrador para publicar.');
        }

        $landingSection->update([
            'live_payload' => $draft,
            'status' => LandingSection::STATUS_LIVE,
            'published_at' => now(),
        ]);

        return back()->with('success', 'Sección publicada.');
    }

    public function discardDraft(LandingSection $landingSection): RedirectResponse
    {
        $landingSection->update([
            'draft_payload' => $landingSection->live_payload,
            'status' => LandingSection::STATUS_LIVE,
        ]);

        return back()->with('success', 'Borrador descartado.');
    }

    public function resetSection(LandingSection $landingSection): RedirectResponse
    {
        if ($landingSection->is_system) {
            $defaults = LandingDefaultPayloads::payloadForSlug($landingSection->slug);
        } else {
            $defaults = [
                'title' => '',
                'subtitle' => '',
                'body_markdown' => '',
                'banner_image_path' => null,
                'banner_overlay_opacity' => 0,
                'primary_cta_text' => null,
                'primary_cta_url' => null,
                'secondary_cta_text' => null,
                'secondary_cta_url' => null,
                'content_image_path' => null,
                'text_align' => 'left',
            ];
        }

        $landingSection->update([
            'draft_payload' => $defaults,
            'status' => LandingSection::STATUS_DRAFT,
        ]);

        return back()->with('success', 'Borrador restablecido al contenido por defecto.');
    }

    public function storeCustomSection(StoreLandingCustomSectionRequest $request): RedirectResponse
    {
        $slug = 'custom-'.Str::lower(Str::random(10));
        $title = $request->validated()['title_internal'];

        LandingSection::create([
            'slug' => $slug,
            'title_internal' => $title,
            'sort_order' => (int) (LandingSection::query()->max('sort_order') ?? 0) + 10,
            'status' => LandingSection::STATUS_DRAFT,
            'is_system' => false,
            'published_at' => null,
            'draft_payload' => [
                'title' => $title,
                'subtitle' => '',
                'body_markdown' => '',
                'banner_image_path' => null,
                'banner_overlay_opacity' => 0,
                'primary_cta_text' => null,
                'primary_cta_url' => null,
                'secondary_cta_text' => null,
                'secondary_cta_url' => null,
                'content_image_path' => null,
                'text_align' => 'left',
            ],
            'live_payload' => null,
        ]);

        return back()->with('success', 'Sección personalizada creada. Edita y publica cuando esté lista.');
    }

    public function destroySection(LandingSection $landingSection): RedirectResponse
    {
        if ($landingSection->is_system) {
            return back()->with('error', 'No se pueden eliminar secciones del sistema.');
        }

        $landingSection->delete();

        return back()->with('success', 'Sección eliminada.');
    }

    public function publishAll(): RedirectResponse
    {
        $sections = LandingSection::query()->whereNotNull('draft_payload')->get();

        foreach ($sections as $section) {
            $section->update([
                'live_payload' => $section->draft_payload,
                'status' => LandingSection::STATUS_LIVE,
                'published_at' => now(),
            ]);
        }

        return back()->with('success', 'Todas las secciones con borrador fueron publicadas.');
    }

    public function storeMedia(StoreLandingMediaRequest $request): JsonResponse
    {
        $uploaded = $request->upload();

        return response()->json([
            'path' => $uploaded['path'],
            'url' => $uploaded['url'],
        ]);
    }

    public function updateGlobals(UpdateLandingGlobalsRequest $request): RedirectResponse
    {
        $global = LandingGlobal::instance();
        $global->update($request->validated());

        return back()->with('success', 'Ajustes globales guardados.');
    }
}
