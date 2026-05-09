<?php

namespace App\Support;

use App\Services\Files\MediaUrlResolver;

final class LandingMediaUrl
{
    public static function resolve(?string $path, MediaUrlResolver $resolver): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        $path = trim($path);

        if (str_starts_with($path, 'images/')) {
            return asset($path);
        }

        return $resolver->url($path);
    }
}
