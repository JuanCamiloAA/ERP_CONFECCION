<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use App\Models\Operation;
use App\Models\Reference;
use App\Support\OperationDifficulty;

/**
 * Detalle de las referencias: que operaciones lleva cada una y a que precio.
 *
 * Va en su propio archivo, despues de referencias y operaciones, para no repetir los
 * datos de cabecera en cada linea. La referencia y la operacion se apuntan por su nombre
 * de negocio —codigo y nombre— dentro de la empresa del NIT, que es lo que el usuario
 * tiene a mano; los id no viajan en el CSV.
 *
 * Cada linea deja el costo operacional de su referencia al dia, igual que si se hubiera
 * agregado desde la pantalla.
 */
class ReferenceOperationImportStrategy implements ImportStrategyInterface
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $referenceCode = trim((string) ($row['reference_code'] ?? ''));
        $operationName = trim((string) ($row['operation_name'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber, 'company_nit');
        }
        if ($referenceCode === '') {
            throw new RowImportException('Falta reference_code.', $lineNumber, 'reference_code');
        }
        if ($operationName === '') {
            throw new RowImportException('Falta operation_name.', $lineNumber, 'operation_name');
        }
        if (trim((string) ($row['price'] ?? '')) === '') {
            throw new RowImportException('Falta price.', $lineNumber, 'price');
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber, 'company_nit', $companyNit);
        }

        $reference = Reference::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('code', $referenceCode)
            ->first();

        if (! $reference) {
            throw new RowImportException('Referencia no encontrada para reference_code en esa empresa.', $lineNumber, 'reference_code', $referenceCode);
        }

        $operation = Operation::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('name', $operationName)
            ->first();

        if (! $operation) {
            throw new RowImportException('Operacion no encontrada para operation_name en esa empresa.', $lineNumber, 'operation_name', $operationName);
        }

        if ($reference->operations()->where('operations.id', $operation->id)->exists()) {
            throw new RowImportException('La referencia ya tiene esa operacion (omitido).', $lineNumber, 'operation_name', $operationName);
        }

        // Lo que publique el catalogo se escribe solo: precio, minutos, activo y lo que
        // se agregue manana a reference_operations.
        $pivot = $this->catalog->attributesFromRow(DataImportBatch::TYPE_REFERENCE_OPERATIONS, $row);

        // El grado de dificultad no se carga: sale de los minutos y de los rangos que la
        // empresa tenga configurados, igual que al agregar la linea desde la pantalla.
        $minutes = $pivot['estimated_minutes'] ?? null;
        $pivot['difficulty_level'] = $minutes !== null
            ? OperationDifficulty::levelFromMinutes((float) $minutes, OperationDifficulty::thresholdsFor($reference->company))
            : null;

        $reference->operations()->attach($operation->id, $pivot);

        $reference->refreshOperationalCost();
    }
}
