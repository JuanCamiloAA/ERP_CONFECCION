<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use League\Csv\Bom;
use League\Csv\Writer;

class TemplateGeneratorService
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

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
5. **Operaciones de referencia** (`reference_operations`) — el detalle: que operaciones lleva cada referencia y a que precio. Requiere que ya esten cargadas las operaciones y las referencias
6. **Empleados y usuarios** (`employees_users`) — requiere `company_nit`; opcional `bank_name` (debe existir en catalogo de bancos de esa empresa)

## Campos de cada plantilla

Cada plantilla se descarga con los campos que se elijan en la pantalla. Los **obligatorios**
salen siempre. La lista de campos disponibles se lee de la base de datos, asi que una
columna nueva aparece sola para marcarla, sin esperar una version del sistema.

## Modos de importacion

- **Empresas — duplicado por NIT:** en la pantalla puede elegir *Omitir* (default) o *Actualizar* filas existentes.
- **Empleados — duplicado por documento:** use la casilla *Actualizar existentes* para sobrescribir datos; sin ella se omite la fila si el documento ya existe.

## Archivos

- `companies.csv`
- `banks.csv`
- `operations.csv`
- `references.csv`
- `reference_operations.csv`
- `employees_users.csv`
MD;
    }

    /**
     * Plantilla de un tipo, con los campos elegidos.
     *
     * Sin seleccion salen todos los que publique el catalogo — que es lo que hay hoy en
     * la tabla, no una lista escrita a mano. Los obligatorios entran siempre, aunque no
     * vengan en la seleccion: sin ellos el archivo no se puede importar.
     *
     * @param  list<string>|null  $fields
     */
    public function csvContent(string $type, ?array $fields = null): string
    {
        $campos = $this->catalog->selectedFields($type, $fields);

        $writer = Writer::createFromString();
        $writer->setOutputBOM(Bom::Utf8);
        $writer->insertOne(array_map(fn (array $campo) => $campo['key'], $campos));
        $writer->insertOne(array_map(fn (array $campo) => $campo['example'], $campos));

        return $writer->toString();
    }

    public function filenameForType(string $type): string
    {
        return in_array($type, DataImportBatch::types(), true) ? $type.'.csv' : 'plantilla.csv';
    }
}
