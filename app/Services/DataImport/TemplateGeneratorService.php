<?php

namespace App\Services\DataImport;

use League\Csv\Bom;
use League\Csv\Writer;

class TemplateGeneratorService
{
    public function readmeMarkdown(): string
    {
        return <<<'MD'
# Importacion masiva de datos (CSV)

## Convenciones

- Codificacion: **UTF-8**
- Separador: coma `,`
- Primera fila: nombres de columna exactos (snake_case, minusculas)
- Fechas: `YYYY-MM-DD`
- Decimales: punto `.` (ej. `15000.50`)
- `company_nit` debe coincidir con el **NIT** de una empresa ya existente en el sistema o cargada antes en el **mismo archivo** de empresas (orden recomendado abajo)

## Orden recomendado

1. **Empresas** (`companies`)
2. **Bancos** (`banks`) — requiere `company_nit`
3. **Operaciones** (`operations`) — requiere `company_nit`
4. **Referencias** (`references`) — requiere `company_nit`
5. **Empleados y usuarios** (`employees_users`) — requiere `company_nit`; opcional `bank_name` (debe existir en catalogo de bancos de esa empresa)

## Modos de importacion

- **Empresas — duplicado por NIT:** en la pantalla puede elegir *Omitir* (default) o *Actualizar* filas existentes.
- **Empleados — duplicado por documento:** use la casilla *Actualizar existentes* para sobrescribir datos; sin ella se omite la fila si el documento ya existe.

## Archivos

- `companies.csv`
- `banks.csv`
- `operations.csv`
- `references.csv`
- `employees_users.csv`
MD;
    }

    public function csvContent(string $type): string
    {
        [$headers, $example] = match ($type) {
            'companies' => $this->companiesTemplate(),
            'banks' => $this->banksTemplate(),
            'operations' => $this->operationsTemplate(),
            'references' => $this->referencesTemplate(),
            'employees_users' => $this->employeesUsersTemplate(),
            default => throw new \InvalidArgumentException('Tipo de plantilla no valido.'),
        };

        $writer = Writer::createFromString();
        $writer->setOutputBOM(Bom::Utf8);
        $writer->insertOne($headers);
        $writer->insertOne($example);

        return $writer->toString();
    }

    public function filenameForType(string $type): string
    {
        return match ($type) {
            'companies' => 'companies.csv',
            'banks' => 'banks.csv',
            'operations' => 'operations.csv',
            'references' => 'references.csv',
            'employees_users' => 'employees_users.csv',
            default => 'plantilla.csv',
        };
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    protected function companiesTemplate(): array
    {
        return [
            ['name', 'nit', 'address', 'phone', 'email', 'is_active'],
            ['EJEMPLO SA', '900123456-1', 'Calle 1 # 2-3', '3001234567', 'contacto@ejemplo.com', '1'],
        ];
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    protected function banksTemplate(): array
    {
        return [
            ['company_nit', 'name', 'code', 'is_active'],
            ['900123456-1', 'EJEMPLO BANCO', 'EB', '1'],
        ];
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    protected function operationsTemplate(): array
    {
        return [
            ['company_nit', 'name', 'description', 'base_price', 'is_active'],
            ['900123456-1', 'EJEMPLO OPERACION', 'Costura', '15000.50', '1'],
        ];
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    protected function referencesTemplate(): array
    {
        return [
            ['company_nit', 'code', 'name', 'description', 'is_active'],
            ['900123456-1', 'REF-01', 'EJEMPLO REFERENCIA', 'Lote demo', '1'],
        ];
    }

    /**
     * @return array{0: list<string>, 1: list<string>}
     */
    protected function employeesUsersTemplate(): array
    {
        return [
            [
                'company_nit',
                'first_name',
                'last_name',
                'document_type',
                'document_number',
                'phone',
                'address',
                'hire_date',
                'base_salary',
                'payroll_mode',
                'daily_salary',
                'is_active',
                'create_user',
                'user_email',
                'user_password',
                'role_name',
                'bank_name',
                'bank_account_number',
                'bank_key',
                'notes',
            ],
            [
                '900123456-1',
                'Juan',
                'Perez',
                'CC',
                '1234567890',
                '3001112233',
                'Calle 2',
                '2025-01-15',
                '1300000',
                'operations',
                '',
                '1',
                '1',
                'juan.perez@ejemplo.com',
                '',
                'Operario de Produccion',
                '',
                '',
                '',
                'Importado por CSV',
            ],
        ];
    }
}
