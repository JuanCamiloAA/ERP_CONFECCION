<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use App\Models\Reference;

class ReferenceImportStrategy implements ImportStrategyInterface
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $code = trim((string) ($row['code'] ?? ''));
        $name = trim((string) ($row['name'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber, 'company_nit');
        }
        if ($code === '') {
            throw new RowImportException('Falta code.', $lineNumber, 'code');
        }
        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber, 'name');
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber, 'company_nit', $companyNit);
        }

        $exists = Reference::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('code', $code)
            ->exists();

        if ($exists) {
            throw new RowImportException('Referencia duplicada (code) para la empresa (omitido).', $lineNumber, 'code', $code);
        }

        // El resto de columnas las pone el catalogo, que es lo que hay hoy en la tabla:
        // asi una columna nueva se importa sin tocar esta clase.
        Reference::create(array_merge(
            $this->catalog->attributesFromRow(DataImportBatch::TYPE_REFERENCES, $row, except: ['code', 'name']),
            [
                'company_id' => $companyId,
                'code' => $code,
                'name' => $name,
            ],
        ));
    }
}
