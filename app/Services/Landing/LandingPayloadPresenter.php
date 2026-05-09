<?php

namespace App\Services\Landing;

use App\Models\Company;
use App\Models\LandingGlobal;
use App\Services\Files\MediaUrlResolver;
use App\Support\LandingMediaUrl;

class LandingPayloadPresenter
{
    public function __construct(
        protected MediaUrlResolver $resolver,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function presentGlobals(LandingGlobal $global): array
    {
        $row = $global->toArray();
        $pathKeys = ['og_image_path', 'header_logo_path', 'favicon_path'];

        foreach ($pathKeys as $key) {
            $path = $global->getAttributes()[$key] ?? null;
            if (is_string($path) && $path !== '') {
                $urlKey = str_replace('_path', '_url', $key);
                $row[$urlKey] = LandingMediaUrl::resolve($path, $this->resolver);
            } else {
                $urlKey = str_replace('_path', '_url', $key);
                $row[$urlKey] = null;
            }
        }

        return $row;
    }

    /**
     * Enriquece ítems de partners con nombre y logo del maestro de empresas cuando llevan company_id.
     *
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>|null
     */
    public function mergePartnerCompaniesFromMaster(?array $payload): ?array
    {
        if ($payload === null || ! isset($payload['items']) || ! is_array($payload['items'])) {
            return $payload;
        }

        $ids = collect($payload['items'])
            ->pluck('company_id')
            ->filter(fn ($id) => $id !== null && $id !== '' && is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return $payload;
        }

        $companies = Company::query()
            ->whereIn('id', $ids->all())
            ->get()
            ->keyBy('id');

        $payload['items'] = collect($payload['items'])->map(function ($item) use ($companies) {
            if (! is_array($item)) {
                return $item;
            }
            $cid = $item['company_id'] ?? null;
            if ($cid === null || $cid === '' || ! is_numeric($cid)) {
                return $item;
            }
            $company = $companies->get((int) $cid);
            if (! $company) {
                return $item;
            }
            $item['name'] = $company->name;
            $rawLogo = $company->getAttributes()['logo'] ?? null;
            $item['logo_path'] = is_string($rawLogo) && $rawLogo !== '' ? $rawLogo : null;

            return $item;
        })->all();

        return $payload;
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>|null
     */
    public function presentPayload(?array $payload): ?array
    {
        if ($payload === null) {
            return null;
        }

        return $this->walk($payload);
    }

    protected function walk(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $out = [];
        foreach ($value as $k => $v) {
            if (is_string($k) && str_ends_with($k, '_path') && is_string($v) && $v !== '') {
                $out[$k] = $v;
                $base = substr($k, 0, -strlen('_path'));
                $out[$base.'_url'] = LandingMediaUrl::resolve($v, $this->resolver);
            } else {
                $out[$k] = $this->walk($v);
            }
        }

        return $out;
    }
}
