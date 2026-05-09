<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandingGlobal extends Model
{
    protected $table = 'landing_globals';

    protected $fillable = [
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
    ];

    public static function instance(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'site_name' => config('app.name'),
                'meta_title' => config('app.name'),
                'meta_description' => '',
            ]
        );
    }
}
