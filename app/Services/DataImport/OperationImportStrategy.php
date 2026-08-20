<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use App\Models\Operation;

class OperationImportStrategy implements ImportStrategyInterface
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));
        $basePriceRaw = $row['base_price'] ?? null;

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber, 'company_nit');
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber, 'name');
        }
        if ($basePriceRaw === null || trim((string) $basePriceRaw) === '') {
            throw new RowImportException('Falta base_price.', $lineNumber, 'base_price');
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber, 'company_nit', $companyNit);
        }

        $exists = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($exists) {
            throw new RowImportException('Operacion duplicada para la empresa (omitido).', $lineNumber, 'name', $name);
        }

        if (! is_numeric(str_replace(',', '.', (string) $basePriceRaw))) {
            throw new RowImportException('base_price no numerico.', $lineNumber, 'base_price', $basePriceRaw);
        }

        $basePrice = (float) str_replace(',', '.', (string) $basePriceRaw);

        // El precio se valida arriba (admite coma decimal); el resto de columnas las
        // pone el catalogo, que las lee de la tabla.
        Operation::create(array_merge(
            $this->catalog->attributesFromRow(DataImportBatch::TYPE_OPERATIONS, $row, except: ['name', 'base_price']),
            ['company_id' => $companyId, 'name' => $name, 'base_price' => $basePrice],
        ));
    }
}
