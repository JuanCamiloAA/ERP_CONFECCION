<?php

namespace App\Services\DataImport;

use App\Models\Reference;

class ReferenceImportStrategy implements ImportStrategyInterface
{
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $code = trim((string) ($row['code'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber);
        }
        if ($code === '') {
            throw new RowImportException('Falta code.', $lineNumber);
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber);
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber);
        }

        $exists = Reference::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('code', $code)
            ->exists();

        if ($exists) {
            throw new RowImportException('Referencia duplicada (code) para la empresa (omitido).', $lineNumber);
        }

        Reference::create([
            'company_id' => $companyId,
            'code' => $code,
            'name' => $name,
            'description' => $this->nullableText($row['description'] ?? null),
            'is_active' => $this->parseBool($row['is_active'] ?? null, true),
        ]);
    }

    protected function nullableText(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        $s = trim((string) $v);

        return $s === '' ? null : $s;
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
