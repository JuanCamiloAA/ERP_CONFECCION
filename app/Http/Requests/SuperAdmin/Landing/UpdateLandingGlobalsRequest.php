<?php

namespace App\Http\Requests\SuperAdmin\Landing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLandingGlobalsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'site_name' => ['nullable', 'string', 'max:120'],
            'meta_title' => ['nullable', 'string', 'max:180'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'og_image_path' => ['nullable', 'string', 'max:500'],
            'header_logo_path' => ['nullable', 'string', 'max:500'],
            'favicon_path' => ['nullable', 'string', 'max:500'],
            'footer_privacy_url' => ['nullable', 'string', 'max:500'],
            'footer_terms_url' => ['nullable', 'string', 'max:500'],
            'footer_contact_url' => ['nullable', 'string', 'max:500'],
            'navbar_cta_text' => ['nullable', 'string', 'max:80'],
            'navbar_cta_url' => ['nullable', 'string', 'max:500'],
            'plan_inquiry_notify_email' => ['nullable', 'email', 'max:255'],
            'footer_legal_text' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
