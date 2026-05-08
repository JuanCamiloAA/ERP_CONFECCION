<?php

namespace App\Services\DataImport;

class DataImportContext
{
    /**
     * @var array<string, int> nit normalizado (trim) => company_id
     */
    protected array $nitToCompanyId = [];

    public function __construct(
        public string $companyImportMode = 'skip',
        public bool $employeeUpdateExisting = false,
    ) {
        if (! in_array($this->companyImportMode, ['skip', 'update'], true)) {
            $this->companyImportMode = 'skip';
        }
    }

    public function rememberCompany(string $nit, int $companyId): void
    {
        $key = $this->normalizeNit($nit);
        if ($key !== '') {
            $this->nitToCompanyId[$key] = $companyId;
        }
    }

    public function resolveCompanyId(string $nit): ?int
    {
        $key = $this->normalizeNit($nit);
        if ($key === '') {
            return null;
        }

        return $this->nitToCompanyId[$key] ?? null;
    }

    public function warmCompanyMap(): void
    {
        $rows = \App\Models\Company::query()->withoutGlobalScopes()->whereNotNull('nit')->get(['id', 'nit']);

        foreach ($rows as $company) {
            $this->rememberCompany((string) $company->nit, (int) $company->id);
        }
    }

    public function normalizeNit(string $nit): string
    {
        return trim($nit);
    }
}
