<?php

namespace App\Services\DataImport;

use App\Models\Operation;

class OperationImportStrategy implements ImportStrategyInterface
{
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));
        $basePriceRaw = $row['base_price'] ?? null;

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber);
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber);
        }
        if ($basePriceRaw === null || trim((string) $basePriceRaw) === '') {
            throw new RowImportException('Falta base_price.', $lineNumber);
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber);
        }

        $exists = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($exists) {
            throw new RowImportException('Operacion duplicada para la empresa (omitido).', $lineNumber);
        }

        if (! is_numeric(str_replace(',', '.', (string) $basePriceRaw))) {
            throw new RowImportException('base_price no numerico.', $lineNumber);
        }

        $basePrice = (float) str_replace(',', '.', (string) $basePriceRaw);

        Operation::create([
            'company_id' => $companyId,
            'name' => $name,
            'description' => $this->nullableText($row['description'] ?? null),
            'base_price' => $basePrice,
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
