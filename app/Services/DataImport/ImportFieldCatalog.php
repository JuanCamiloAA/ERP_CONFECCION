<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * Que columnas admite cada plantilla de importacion.
 *
 * El catalogo se arma leyendo la tabla, no una lista escrita a mano: si manana se agrega
 * una columna al modelo, aparece sola en el selector de campos, sale en la plantilla y la
 * estrategia la escribe sin que haya que tocar codigo. Aqui solo se declara lo que NO
 * puede salir del esquema: las columnas tecnicas que se excluyen, los campos virtuales
 * (company_nit y demas, que no son columnas sino claves para resolver una relacion), los
 * ejemplos y el orden con que se han venido publicando las plantillas.
 *
 * Un campo es obligatorio cuando la columna no admite nulos y no trae valor por defecto
 * —o sea, cuando la base no puede guardar la fila sin el—, mas los que cada tipo declare
 * porque los exige la importacion aunque la columna tenga default.
 *
 * Aviso para quien agregue una columna: para que ademas se guarde, tiene que estar en el
 * `$fillable` de su modelo. Si no, sale en la plantilla pero la asignacion masiva la
 * descarta en silencio.
 *
 * @phpstan-type Campo array{key: string, required: bool, example: string, help: ?string, column: ?string}
 */
final class ImportFieldCatalog
{
    /** Nunca viajan en un CSV: las pone la base o el propio proceso. */
    private const TECNICAS = ['id', 'created_at', 'updated_at', 'deleted_at'];

    /**
     * Lo que no se puede deducir del esquema, por tipo de importacion.
     *
     * - `excluye`: columnas reales que no tienen sentido en un CSV (archivos, JSON,
     *   llaves foraneas que se resuelven por nombre, valores derivados por el sistema).
     * - `virtuales`: campos que no son columnas; los resuelve la estrategia.
     * - `obligatorios`: campos que la importacion exige aunque la columna admita default.
     * - `orden`: como se han venido publicando; lo que no este aqui va al final, que es
     *   por donde apareceran las columnas nuevas.
     */
    private const TIPOS = [
        DataImportBatch::TYPE_COMPANIES => [
            'table' => 'companies',
            'excluye' => ['logo', 'settings', 'membership_plan_id', 'membership_started_at', 'membership_ends_at'],
            'virtuales' => [],
            // La columna admite nulos, pero el NIT es la llave con que las demas plantillas
            // apuntan a la empresa: sin el, nada de lo que venga despues la encuentra.
            'obligatorios' => ['nit'],
            'orden' => ['name', 'nit', 'address', 'phone', 'email', 'is_active'],
            'ejemplos' => [
                'name' => 'EJEMPLO SA',
                'nit' => '900123456-1',
                'address' => 'Calle 1 # 2-3',
                'phone' => '3001234567',
                'email' => 'contacto@ejemplo.com',
                'is_active' => '1',
            ],
        ],

        DataImportBatch::TYPE_BANKS => [
            'table' => 'banks',
            'excluye' => ['company_id'],
            'virtuales' => [
                ['key' => 'company_nit', 'required' => true, 'example' => '900123456-1', 'help' => 'NIT de una empresa ya existente.'],
            ],
            'obligatorios' => [],
            'orden' => ['company_nit', 'name', 'code', 'is_active'],
            'ejemplos' => ['name' => 'EJEMPLO BANCO', 'code' => 'EB', 'is_active' => '1'],
        ],

        DataImportBatch::TYPE_OPERATIONS => [
            'table' => 'operations',
            'excluye' => ['company_id'],
            'virtuales' => [
                ['key' => 'company_nit', 'required' => true, 'example' => '900123456-1', 'help' => 'NIT de una empresa ya existente.'],
            ],
            // La columna trae default 0.00, pero importar una operacion sin precio no
            // sirve para nada: la importacion lo viene exigiendo y se mantiene asi.
            'obligatorios' => ['base_price'],
            'orden' => ['company_nit', 'name', 'description', 'base_price', 'estimated_minutes', 'difficulty_level', 'is_active'],
            'ejemplos' => [
                'name' => 'EJEMPLO OPERACION',
                'description' => 'Costura',
                'base_price' => '15000.50',
                'estimated_minutes' => '5.5',
                'difficulty_level' => '1',
                'is_active' => '1',
            ],
        ],

        DataImportBatch::TYPE_REFERENCES => [
            'table' => 'references',
            'excluye' => [
                'company_id',
                'image',
                // Se calculan solos desde el detalle de operaciones; ver Reference::refreshOperationalCost().
                'operational_cost_per_unit_fixed',
                'operational_lot_qty_at_cost_fix',
            ],
            'virtuales' => [
                ['key' => 'company_nit', 'required' => true, 'example' => '900123456-1', 'help' => 'NIT de una empresa ya existente.'],
            ],
            'obligatorios' => [],
            'orden' => ['company_nit', 'code', 'name', 'description', 'payment_per_unit', 'lot_total_quantity', 'is_active'],
            'ejemplos' => [
                'code' => 'REF-01',
                'name' => 'EJEMPLO REFERENCIA',
                'description' => 'Lote demo',
                'payment_per_unit' => '3800',
                'lot_total_quantity' => '500',
                'is_active' => '1',
            ],
        ],

        DataImportBatch::TYPE_REFERENCE_OPERATIONS => [
            'table' => 'reference_operations',
            'excluye' => [
                'reference_id',
                'operation_id',
                // Sale de los minutos y de los rangos de Mi empresa; no se carga a mano.
                'difficulty_level',
            ],
            'virtuales' => [
                ['key' => 'company_nit', 'required' => true, 'example' => '900123456-1', 'help' => 'NIT de una empresa ya existente.'],
                ['key' => 'reference_code', 'required' => true, 'example' => 'REF-01', 'help' => 'Codigo de una referencia de esa empresa.'],
                ['key' => 'operation_name', 'required' => true, 'example' => 'EJEMPLO OPERACION', 'help' => 'Nombre de una operacion de esa empresa.'],
            ],
            'obligatorios' => [],
            'orden' => ['company_nit', 'reference_code', 'operation_name', 'price', 'estimated_minutes', 'is_active'],
            'ejemplos' => ['price' => '848', 'estimated_minutes' => '3.5', 'is_active' => '1'],
        ],

        DataImportBatch::TYPE_EMPLOYEES_USERS => [
            'table' => 'employees',
            'excluye' => [
                'company_id',
                'user_id',
                'photo',
                'bank_id',
                // Es un JSON con la jornada; no cabe en una celda de CSV.
                'scheduled_work_days',
            ],
            'virtuales' => [
                ['key' => 'company_nit', 'required' => true, 'example' => '900123456-1', 'help' => 'NIT de una empresa ya existente.'],
                ['key' => 'create_user', 'required' => false, 'example' => '1', 'help' => '1 para crearle acceso al sistema.'],
                ['key' => 'user_email', 'required' => false, 'example' => 'juan.perez@ejemplo.com', 'help' => 'Correo de acceso; si falta se usa email.'],
                ['key' => 'user_password', 'required' => false, 'example' => '', 'help' => 'Vacio genera una temporal.'],
                ['key' => 'role_name', 'required' => false, 'example' => 'Operario de Produccion', 'help' => 'Rol existente en la empresa.'],
                ['key' => 'bank_name', 'required' => false, 'example' => '', 'help' => 'Banco del catalogo de esa empresa.'],
            ],
            'obligatorios' => [],
            'orden' => [
                'company_nit', 'first_name', 'last_name', 'document_type', 'document_number',
                'phone', 'email', 'address', 'hire_date', 'base_salary', 'payroll_mode',
                'daily_salary', 'minutes_per_full_workday', 'ordinary_hours_per_day',
                'is_exempt_from_overtime', 'is_active', 'create_user', 'user_email',
                'user_password', 'role_name', 'bank_name', 'bank_account_number', 'bank_key', 'notes',
            ],
            'ejemplos' => [
                'first_name' => 'Juan',
                'last_name' => 'Perez',
                'document_type' => 'CC',
                'document_number' => '1234567890',
                'phone' => '3001112233',
                'email' => 'juan.perez@ejemplo.com',
                'address' => 'Calle 2',
                'hire_date' => '2025-01-15',
                'base_salary' => '1300000',
                'payroll_mode' => 'operations',
                'is_active' => '1',
                'notes' => 'Importado por CSV',
            ],
        ],
    ];

    /** @var array<string, list<Campo>> */
    private array $memo = [];

    /**
     * Campos que admite un tipo, en el orden en que salen en la plantilla.
     *
     * @return list<Campo>
     */
    public function fields(string $type): array
    {
        if (isset($this->memo[$type])) {
            return $this->memo[$type];
        }

        $tipo = self::TIPOS[$type] ?? throw new InvalidArgumentException('Tipo de importacion no valido.');

        $campos = [];

        foreach ($tipo['virtuales'] as $virtual) {
            $campos[$virtual['key']] = [
                'key' => $virtual['key'],
                'required' => (bool) $virtual['required'],
                'example' => (string) $virtual['example'],
                'help' => $virtual['help'] ?? null,
                'column' => null,
            ];
        }

        foreach ($this->columns($tipo['table']) as $columna) {
            $nombre = $columna['name'];

            if (in_array($nombre, self::TECNICAS, true) || in_array($nombre, $tipo['excluye'], true)) {
                continue;
            }

            $campos[$nombre] = [
                'key' => $nombre,
                'required' => $this->esObligatoria($columna) || in_array($nombre, $tipo['obligatorios'], true),
                'example' => $tipo['ejemplos'][$nombre] ?? $this->ejemploPorTipo($columna),
                'help' => null,
                'column' => $nombre,
            ];
        }

        return $this->memo[$type] = $this->ordenar($campos, $tipo['orden']);
    }

    /**
     * Solo las claves obligatorias. Van siempre en la plantilla, se elija lo que se elija.
     *
     * @return list<string>
     */
    public function requiredKeys(string $type): array
    {
        return array_values(array_map(
            fn (array $campo) => $campo['key'],
            array_filter($this->fields($type), fn (array $campo) => $campo['required']),
        ));
    }

    /**
     * Depura una seleccion venida del navegador: descarta lo que no existe, agrega lo
     * obligatorio y devuelve todo en el orden del catalogo. Sin seleccion, van todos.
     *
     * @param  list<string>|null  $seleccion
     * @return list<Campo>
     */
    public function selectedFields(string $type, ?array $seleccion): array
    {
        $campos = $this->fields($type);

        if ($seleccion === null || $seleccion === []) {
            return $campos;
        }

        $pedidos = array_flip(array_map('strval', $seleccion));

        return array_values(array_filter(
            $campos,
            fn (array $campo) => $campo['required'] || isset($pedidos[$campo['key']]),
        ));
    }

    /**
     * Valores de la fila que van directo a columnas de la tabla, ya convertidos al tipo
     * que espera cada una.
     *
     * Es lo que permite que una columna nueva se importe sin tocar la estrategia: lo que
     * el catalogo publica, esto lo escribe. Las claves ausentes o vacias no se incluyen,
     * para que la columna conserve su valor por defecto en vez de quedar en blanco.
     *
     * @param  array<string, mixed>  $row
     * @param  list<string>  $except  Claves que la estrategia arma por su cuenta.
     * @return array<string, mixed>
     */
    public function attributesFromRow(string $type, array $row, array $except = []): array
    {
        $tipo = self::TIPOS[$type] ?? throw new InvalidArgumentException('Tipo de importacion no valido.');
        $porNombre = collect($this->columns($tipo['table']))->keyBy('name');

        $attrs = [];

        foreach ($this->fields($type) as $campo) {
            $columna = $campo['column'];

            if ($columna === null || in_array($columna, $except, true) || ! array_key_exists($columna, $row)) {
                continue;
            }

            $valor = $this->cast($row[$columna], $porNombre[$columna] ?? null);

            if ($valor === null) {
                continue;
            }

            $attrs[$columna] = $valor;
        }

        return $attrs;
    }

    /**
     * Catalogo completo para el selector de campos del navegador.
     *
     * @return array<string, list<Campo>>
     */
    public function all(): array
    {
        $catalogo = [];

        foreach (array_keys(self::TIPOS) as $type) {
            $catalogo[$type] = $this->fields($type);
        }

        return $catalogo;
    }

    /**
     * @return list<array{name: string, type_name: string, nullable: bool, default: mixed}>
     */
    private function columns(string $table): array
    {
        return Schema::getColumns($table);
    }

    /**
     * La base no puede guardar la fila sin este dato: no admite nulos y no hay default.
     *
     * @param  array{nullable: bool, default: mixed}  $columna
     */
    private function esObligatoria(array $columna): bool
    {
        return ! $columna['nullable'] && ($columna['default'] === null || $columna['default'] === '');
    }

    /**
     * Si la columna guarda un si/no.
     *
     * Hay que mirar el tipo completo y no solo su nombre: en MySQL `tinyint(1)` es el
     * booleano, mientras que `tinyint(3) unsigned` es un entero pequeno —el grado de
     * dificultad, por ejemplo—. Confundirlos hace que un 3 se lea como «ni si ni no» y
     * la columna se quede con su valor por defecto.
     *
     * @param  array{type_name: string, type?: string}  $columna
     */
    private function esBooleana(array $columna): bool
    {
        $nombre = strtolower($columna['type_name']);

        if (in_array($nombre, ['bool', 'boolean'], true)) {
            return true;
        }

        return $nombre === 'tinyint' && str_starts_with(strtolower($columna['type'] ?? ''), 'tinyint(1)');
    }

    /**
     * Ejemplo para una columna sin ejemplo escrito: es el caso de las que se agreguen
     * mas adelante, que asi salen en la plantilla con algo coherente con su tipo.
     *
     * @param  array{type_name: string, type?: string}  $columna
     */
    private function ejemploPorTipo(array $columna): string
    {
        if ($this->esBooleana($columna)) {
            return '1';
        }

        return match (strtolower($columna['type_name'])) {
            'tinyint', 'int', 'integer', 'bigint', 'smallint', 'mediumint' => '0',
            'decimal', 'numeric', 'float', 'double' => '0.00',
            'date', 'datetime', 'timestamp' => '2025-01-15',
            default => '',
        };
    }

    /**
     * @param  array{type_name: string, type?: string}|null  $columna
     */
    private function cast(mixed $valor, ?array $columna): mixed
    {
        if ($valor === null) {
            return null;
        }

        $texto = trim((string) $valor);
        if ($texto === '') {
            return null;
        }

        if ($columna !== null && $this->esBooleana($columna)) {
            return $this->aBooleano($texto);
        }

        return match (strtolower($columna['type_name'] ?? 'varchar')) {
            'tinyint', 'int', 'integer', 'bigint', 'smallint', 'mediumint' => is_numeric($texto) ? (int) $texto : null,
            'decimal', 'numeric', 'float', 'double' => is_numeric($texto) ? (float) $texto : null,
            default => $texto,
        };
    }

    private function aBooleano(string $texto): ?bool
    {
        $s = strtolower($texto);

        if (in_array($s, ['1', 'true', 'yes', 'si', 'sí'], true)) {
            return true;
        }

        if (in_array($s, ['0', 'false', 'no'], true)) {
            return false;
        }

        return null;
    }

    /**
     * @param  array<string, Campo>  $campos
     * @param  list<string>  $orden
     * @return list<Campo>
     */
    private function ordenar(array $campos, array $orden): array
    {
        $ordenados = [];

        foreach ($orden as $key) {
            if (isset($campos[$key])) {
                $ordenados[] = $campos[$key];
                unset($campos[$key]);
            }
        }

        // Lo que no estaba en el orden declarado va al final: por ahi asoman, sin tocar
        // nada, las columnas que se agreguen a la tabla mas adelante.
        return array_merge($ordenados, array_values($campos));
    }
}
