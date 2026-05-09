<?php

namespace App\Support;

use App\Services\Files\FirebaseStorageService;
use Illuminate\Support\Facades\File;
use Throwable;

class BrandIcon
{
    public static function url(): string
    {
        $override = config('branding.icon_url');
        if (is_string($override) && $override !== '') {
            return $override;
        }

        $object = config('branding.firebase_icon_object');
        $bucket = config('firebase.storage_bucket');
        $hasCredentials = (is_string(config('firebase.credentials_path')) && config('firebase.credentials_path') !== '')
            || (is_string(config('firebase.credentials_json')) && config('firebase.credentials_json') !== '');

        if (is_string($object) && $object !== '' && is_string($bucket) && $bucket !== '' && $hasCredentials) {
            try {
                return app(FirebaseStorageService::class)->readableUrl($object);
            } catch (Throwable) {
                // Intentar copia local
            }
        }

        $relative = config('branding.local_icon_path');
        if (is_string($relative) && $relative !== '' && File::exists(public_path($relative))) {
            return asset($relative);
        }

        return '';
    }
}
