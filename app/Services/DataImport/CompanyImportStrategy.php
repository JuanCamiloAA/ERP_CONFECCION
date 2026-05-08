<?php

namespace App\Services\DataImport;

use App\Models\Company;
use Illuminate\Support\Str;

class CompanyImportStrategy implements ImportStrategyInterface
{
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $name = trim((string) ($row['name'] ?? ''));
        $nit = trim((string) ($row['nit'] ?? ''));

        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber);
        }
        if ($nit === '') {
            throw new RowImportException('Falta nit.', $lineNumber);
        }

        $existing = Company::query()->withoutGlobalScopes()->where('nit', $nit)->first();

        if ($existing) {
            if ($ctx->companyImportMode === 'update') {
                $existing->update([
                    'name' => $name,
                    'address' => $this->nullableString($row['address'] ?? null),
                    'phone' => $this->nullableString($row['phone'] ?? null),
                    'email' => $this->nullableString($row['email'] ?? null),
                    'is_active' => $this->parseBool($row['is_active'] ?? null, true),
                ]);
                $ctx->rememberCompany($nit, (int) $existing->id);

                return;
            }

            throw new RowImportException('Empresa con NIT ya existe (modo omitir).', $lineNumber);
        }

        $company = Company::create([
            'name' => $name,
            'nit' => $nit,
            'address' => $this->nullableString($row['address'] ?? null),
            'phone' => $this->nullableString($row['phone'] ?? null),
            'email' => $this->nullableEmail($row['email'] ?? null),
            'is_active' => $this->parseBool($row['is_active'] ?? null, true),
        ]);

        $ctx->rememberCompany($nit, (int) $company->id);
    }

    protected function nullableString(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        $s = trim((string) $v);

        return $s === '' ? null : Str::limit($s, 255);
    }

    protected function nullableEmail(mixed $v): ?string
    {
        $s = $this->nullableString($v);
        if ($s === null) {
            return null;
        }

        if (! filter_var($s, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return Str::limit($s, 120);
    }

    protected function parseBool(mixed $v, bool $default): bool
    {
        if ($v === null || $v === '') {
            return $default;
        }

        $s = strtolower(trim((string) $v));

        if (in_array($s, ['1', 'true', 'yes', 'si', 'sí'], true)) {
            return true;
        }

        if (in_array($s, ['0', 'false', 'no'], true)) {
            return false;
        }

        return $default;
    }
}
