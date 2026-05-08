<?php

namespace App\Services\DataImport;

use App\Models\Bank;

class BankImportStrategy implements ImportStrategyInterface
{
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber);
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber);
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber);
        }

        $exists = Bank::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($exists) {
            throw new RowImportException('Banco duplicado para la empresa (omitido).', $lineNumber);
        }

        Bank::create([
            'company_id' => $companyId,
            'name' => $name,
            'code' => $this->nullable($row['code'] ?? null, 50),
            'is_active' => $this->parseBool($row['is_active'] ?? null, true),
        ]);
    }

    protected function nullable(mixed $v, int $max): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        $s = trim((string) $v);

        return $s === '' ? null : mb_substr($s, 0, $max);
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
