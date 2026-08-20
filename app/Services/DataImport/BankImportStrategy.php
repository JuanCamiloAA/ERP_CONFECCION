<?php

namespace App\Services\DataImport;

use App\Models\Bank;
use App\Models\DataImportBatch;

class BankImportStrategy implements ImportStrategyInterface
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber, 'company_nit');
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber, 'name');
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber, 'company_nit', $companyNit);
        }

        $exists = Bank::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($exists) {
            throw new RowImportException('Banco duplicado para la empresa (omitido).', $lineNumber, 'name', $name);
        }

        // Las demas columnas salen del catalogo, que las lee de la tabla.
        Bank::create(array_merge(
            $this->catalog->attributesFromRow(DataImportBatch::TYPE_BANKS, $row, except: ['name']),
            ['company_id' => $companyId, 'name' => $name],
        ));
    }
}
