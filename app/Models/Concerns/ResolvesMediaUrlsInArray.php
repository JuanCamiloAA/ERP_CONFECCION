<?php

namespace App\Models\Concerns;

use App\Services\Files\MediaUrlResolver;

trait ResolvesMediaUrlsInArray
{
    public function toArray(): array
    {
        $array = parent::toArray();

        if (! property_exists($this, 'mediaUrlAttributes')) {
            return $array;
        }

        /** @var list<string> $fields */
        $fields = $this->mediaUrlAttributes;

        if ($fields === []) {
            return $array;
        }

        $resolver = app(MediaUrlResolver::class);

        foreach ($fields as $field) {
            if (! array_key_exists($field, $array) || $array[$field] === null || $array[$field] === '') {
                continue;
            }

            $array[$field] = $resolver->url((string) $array[$field]);
        }

        return $array;
    }
}
