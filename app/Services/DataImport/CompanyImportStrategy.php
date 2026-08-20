<?php

namespace App\Services\DataImport;

use App\Models\Company;
use App\Models\DataImportBatch;
use Illuminate\Support\Str;

class CompanyImportStrategy implements ImportStrategyInterface
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $name = trim((string) ($row['name'] ?? ''));
        $nit = trim((string) ($row['nit'] ?? ''));

        if ($name === '') {
            throw new RowImportException('Falta name.', $lineNumber, 'name');
        }
        if ($nit === '') {
            throw new RowImportException('Falta nit.', $lineNumber, 'nit');
        }

        $existing = Company::query()->withoutGlobalScopes()->where('nit', $nit)->first();

        if ($existing) {
            if ($ctx->companyImportMode === 'update') {
                // Solo se pisan las columnas que traiga el archivo: una plantilla con
                // pocos campos actualiza esos y deja el resto de la empresa como estaba.
                $existing->update(array_merge(
                    $this->catalog->attributesFromRow(DataImportBatch::TYPE_COMPANIES, $row, except: ['name', 'nit']),
                    ['name' => $name],
                ));
                $ctx->rememberCompany($nit, (int) $existing->id);

                return;
            }

            throw new RowImportException('Empresa con NIT ya existe (modo omitir).', $lineNumber, 'nit', $nit);
        }

        $company = Company::create(array_merge(
            $this->catalog->attributesFromRow(DataImportBatch::TYPE_COMPANIES, $row, except: ['name', 'nit', 'email']),
            [
                'name' => $name,
                'nit' => $nit,
                // El correo pasa por su propia comprobacion: uno invalido entra como nulo
                // en vez de tumbar la fila.
                'email' => $this->nullableEmail($row['email'] ?? null),
            ],
        ));

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
}
