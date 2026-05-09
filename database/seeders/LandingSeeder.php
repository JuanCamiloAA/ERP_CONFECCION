<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\LandingGlobal;
use App\Models\LandingSection;
use App\Models\MembershipPlan;
use App\Support\LandingDefaultPayloads;
use Illuminate\Database\Seeder;

class LandingSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedMembershipPlans();

        $global = LandingGlobal::instance();
        $global->update([
            'site_name' => 'MiTallerPro',
            'meta_title' => 'MiTallerPro — Software para talleres de confección',
            'meta_description' => 'Producción, nómina, personal y control operativo multiempresa para talleres de confección.',
            'header_logo_path' => null,
            'favicon_path' => null,
            'og_image_path' => null,
            'footer_privacy_url' => '#',
            'footer_terms_url' => '#',
            'footer_contact_url' => '#',
            'navbar_cta_text' => 'Acceso clientes',
            'navbar_cta_url' => '/login',
            'footer_legal_text' => '© '.date('Y').' MiTallerPro. Todos los derechos reservados.',
        ]);

        $payloads = LandingDefaultPayloads::payloadBySlug();

        foreach (LandingDefaultPayloads::sectionDefinitions() as $def) {
            $slug = $def['slug'];
            $payload = $payloads[$slug] ?? [];

            LandingSection::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'title_internal' => $def['title_internal'],
                    'sort_order' => $def['sort_order'],
                    'status' => LandingSection::STATUS_LIVE,
                    'is_system' => $def['is_system'],
                    'published_at' => now(),
                    'draft_payload' => $payload,
                    'live_payload' => $payload,
                ]
            );
        }

        $defaultPlan = MembershipPlan::query()->where('slug', 'profesional')->first()
            ?? MembershipPlan::query()->orderBy('sort_order')->first();

        if ($defaultPlan) {
            Company::query()->whereNull('membership_plan_id')->update([
                'membership_plan_id' => $defaultPlan->id,
            ]);
        }
    }

    protected function seedMembershipPlans(): void
    {
        MembershipPlan::query()->updateOrCreate(
            ['slug' => 'basico'],
            [
                'name' => 'Basico',
                'max_staff_users' => 5,
                'max_employees' => 15,
                'features_json' => [
                    'Hasta 5 usuarios de escritorio',
                    'Hasta 15 empleados en nómina',
                    'Soporte estándar',
                ],
                'price_monthly' => 150000,
                'is_active' => true,
                'sort_order' => 10,
            ]
        );

        MembershipPlan::query()->updateOrCreate(
            ['slug' => 'inicial'],
            [
                'name' => 'Inicial',
                'max_staff_users' => 20,
                'max_employees' => null,
                'features_json' => [
                    'Hasta 20 usuarios de escritorio',
                    'Ilimitados empleados en nómina',
                    'Soporte avanzado',
                ],
                'price_monthly' => 350000,
                'is_active' => true,
                'sort_order' => 15,
            ]
        );

        MembershipPlan::query()->updateOrCreate(
            ['slug' => 'profesional'],
            [
                'name' => 'Profesional',
                'max_staff_users' => null,
                'max_employees' => null,
                'features_json' => [
                    'Usuarios staff ilimitados',
                    'Empleados ilimitados',
                    'Importación CSV y reportes avanzados',
                ],
                'price_monthly' => 149.00,
                'is_active' => true,
                'sort_order' => 20,
            ]
        );
    }
}
