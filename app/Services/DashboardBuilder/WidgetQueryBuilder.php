<?php

namespace App\Services\DashboardBuilder;

use App\Models\DashboardWidget;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Nucleo de seguridad del constructor de widgets: valida todo contra la whitelist de
 * config/dashboard_builder.php ANTES de tocar la base de datos.
 *
 * Regla de oro: la consulta de un widget se define una sola vez, pero se ejecuta muchas
 * veces (una por empresa que lo ve). El $companyId de filtrado SIEMPRE es el de la empresa
 * efectiva de quien esta viendo el dashboard en ese momento - nunca un valor guardado en la
 * definicion del widget, nunca confiado del cliente.
 */
class WidgetQueryBuilder
{
    public const ALLOWED_OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'like'];

    public const ALLOWED_AGGREGATIONS = ['sum', 'count', 'avg', 'min', 'max'];

    public const ALLOWED_GRANULARITIES = ['day', 'week', 'month'];

    protected const FORBIDDEN_SQL_KEYWORDS = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
        'GRANT', 'REVOKE', 'CREATE', 'REPLACE', 'CALL', 'EXEC',
    ];

    /**
     * @param  array<string, int|string|null>  $sessionVariables  valores ya resueltos del usuario que ve el
     *  dashboard (ver self::sessionVariables() para las claves permitidas). Nunca confiar en valores que
     *  vengan del cliente: siempre construidos por el controlador desde $request->user().
     * @return array<string, mixed> forma normalizada segun el tipo del widget:
     *  - kpi: ['value' => number]
     *  - bar/line/pie: ['labels' => string[], 'series' => number[]]
     *  - table: ['columns' => string[], 'rows' => array<int, array<string, mixed>>]
     */
    public function execute(DashboardWidget $widget, ?int $companyId, array $sessionVariables = []): array
    {
        if ($widget->query_mode === DashboardWidget::QUERY_MODE_SQL) {
            return $this->executeSql((string) $widget->raw_sql, $companyId, $widget->type, $sessionVariables);
        }

        return $this->executeGuided((array) $widget->query_definition, $companyId, $widget->type, $sessionVariables);
    }

    // ------------------------------------------------------------------
    // Modo guiado
    // ------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $definition
     * @param  array<string, int|string|null>  $sessionVariables
     */
    public function executeGuided(array $definition, ?int $companyId, string $type, array $sessionVariables = []): array
    {
        $table = (string) ($definition['table'] ?? '');
        if (! self::isTableAllowed($table)) {
            throw new WidgetQueryException("Tabla no permitida: {$table}");
        }

        $tableConfig = self::tableConfig($table);

        if ($type === DashboardWidget::TYPE_TABLE) {
            return $this->executeGuidedTable($definition, $table, $tableConfig, $companyId, $sessionVariables);
        }

        return $this->executeGuidedMetric($definition, $table, $tableConfig, $companyId, $type, $sessionVariables);
    }

    /**
     * @param  array<string, mixed>  $definition
     * @param  array<string, mixed>  $tableConfig
     * @param  array<string, int|string|null>  $sessionVariables
     */
    protected function executeGuidedMetric(array $definition, string $table, array $tableConfig, ?int $companyId, string $type, array $sessionVariables): array
    {
        $metric = $definition['metric'] ?? null;
        if (! is_array($metric) || ! isset($metric['column'], $metric['aggregation'])) {
            throw new WidgetQueryException('Falta la metrica (columna y agregacion) de la consulta.');
        }

        $metricColumn = (string) $metric['column'];
        $aggregation = strtolower((string) $metric['aggregation']);
        $this->assertColumnAllowed($tableConfig, $metricColumn, 'aggregatable');
        $this->assertAggregationAllowed($aggregation);

        $groupBy = $definition['group_by'] ?? null;
        if ($type === DashboardWidget::TYPE_KPI && $groupBy) {
            throw new WidgetQueryException('Un widget KPI no admite agrupacion (group_by).');
        }

        $query = $this->baseQuery($table, $tableConfig, $companyId);
        $this->applyFilters($query, $tableConfig, (array) ($definition['filters'] ?? []), $sessionVariables);

        $metricExpr = sprintf('%s(`%s`) as agg_value', strtoupper($aggregation), $metricColumn);

        if (is_array($groupBy) && isset($groupBy['column'])) {
            $groupColumn = (string) $groupBy['column'];
            $this->assertColumnAllowed($tableConfig, $groupColumn, 'groupable');
            $columnType = $tableConfig['columns'][$groupColumn]['type'] ?? null;

            if ($columnType === 'date') {
                $granularity = in_array($groupBy['granularity'] ?? 'day', self::ALLOWED_GRANULARITIES, true)
                    ? $groupBy['granularity']
                    : 'day';
                $groupExpr = $this->dateGroupExpression($groupColumn, $granularity);
            } else {
                $groupExpr = "`{$groupColumn}`";
            }

            $rows = $query
                ->selectRaw("{$groupExpr} as group_label, {$metricExpr}")
                ->groupBy('group_label')
                ->orderBy('group_label')
                ->limit($this->maxRows())
                ->get();

            return [
                'labels' => $rows->pluck('group_label')->map(fn ($v) => (string) $v)->all(),
                'series' => $rows->pluck('agg_value')->map(fn ($v) => (float) $v)->all(),
            ];
        }

        $value = $query->selectRaw($metricExpr)->value('agg_value');

        return ['value' => (float) ($value ?? 0)];
    }

    /**
     * @param  array<string, mixed>  $definition
     * @param  array<string, mixed>  $tableConfig
     * @param  array<string, int|string|null>  $sessionVariables
     */
    protected function executeGuidedTable(array $definition, string $table, array $tableConfig, ?int $companyId, array $sessionVariables): array
    {
        $columns = $definition['columns'] ?? [];
        if (! is_array($columns) || $columns === []) {
            throw new WidgetQueryException('Debes seleccionar al menos una columna para el widget de tabla.');
        }
        $columns = array_map('strval', $columns);
        foreach ($columns as $column) {
            $this->assertColumnAllowed($tableConfig, $column);
        }

        $query = $this->baseQuery($table, $tableConfig, $companyId);
        $this->applyFilters($query, $tableConfig, (array) ($definition['filters'] ?? []), $sessionVariables);

        $orderBy = $definition['order_by'] ?? null;
        if (is_array($orderBy) && isset($orderBy['column'])) {
            $orderColumn = (string) $orderBy['column'];
            if (in_array($orderColumn, $columns, true)) {
                $direction = strtolower((string) ($orderBy['direction'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
                $query->orderBy($orderColumn, $direction);
            }
        }

        $limit = min((int) ($definition['limit'] ?? $this->maxRows()), $this->maxRows());
        $rows = $query->select($columns)->limit(max(1, $limit))->get();

        return [
            'columns' => array_values($columns),
            'rows' => $rows->map(fn ($row) => (array) $row)->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $tableConfig
     */
    protected function baseQuery(string $table, array $tableConfig, ?int $companyId): Builder
    {
        $query = DB::table($table);

        if ($tableConfig['has_company_scope'] ?? false) {
            if ($companyId === null) {
                throw new WidgetQueryException(
                    'Esta tabla requiere una empresa de contexto; no puede ejecutarse en vista consolidada sin empresa asignada.'
                );
            }
            $query->where('company_id', $companyId);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $tableConfig
     * @param  array<int, array<string, mixed>>  $filters
     * @param  array<string, int|string|null>  $sessionVariables
     */
    protected function applyFilters(Builder $query, array $tableConfig, array $filters, array $sessionVariables = []): void
    {
        foreach ($filters as $filter) {
            if (! is_array($filter) || ! isset($filter['column'], $filter['operator'])) {
                continue;
            }

            $column = (string) $filter['column'];
            $operator = strtolower((string) $filter['operator']);
            $this->assertColumnAllowed($tableConfig, $column);

            if (! in_array($operator, self::ALLOWED_OPERATORS, true)) {
                throw new WidgetQueryException("Operador de filtro no permitido: {$operator}");
            }

            $valueType = (string) ($filter['value_type'] ?? 'literal');

            if ($valueType === 'variable') {
                $variableName = (string) ($filter['value'] ?? '');
                if (! self::isSessionVariableAllowed($variableName)) {
                    throw new WidgetQueryException("Variable de sesion no permitida: {$variableName}");
                }

                if (! array_key_exists($variableName, $sessionVariables) || $sessionVariables[$variableName] === null) {
                    // El visor actual no tiene esta variable resuelta (ej. admin sin employee_id
                    // en un widget filtrado por "empleado actual"): resultado vacio, nunca todas las filas.
                    $query->whereRaw('1 = 0');

                    return;
                }

                $query->where($column, $operator, $sessionVariables[$variableName]);

                continue;
            }

            $value = $filter['value'] ?? null;
            if ($operator === 'like') {
                $value = '%'.$value.'%';
            }

            $query->where($column, $operator, $value);
        }
    }

    protected function dateGroupExpression(string $column, string $granularity): string
    {
        $col = "`{$column}`";

        return match ($granularity) {
            'week' => "DATE(DATE_SUB({$col}, INTERVAL WEEKDAY({$col}) DAY))",
            'month' => "DATE_FORMAT({$col}, '%Y-%m-01')",
            default => "DATE({$col})",
        };
    }

    // ------------------------------------------------------------------
    // Modo SQL avanzado
    // ------------------------------------------------------------------

    /**
     * @param  array<string, int|string|null>  $sessionVariables
     */
    public function executeSql(string $sql, ?int $companyId, string $type, array $sessionVariables = []): array
    {
        $sql = trim($sql);
        $this->assertSqlSafe($sql);

        $bindings = [];
        if (self::sqlReferencesCompanyPlaceholder($sql)) {
            if ($companyId === null) {
                throw new WidgetQueryException('Esta consulta requiere una empresa de contexto (:company_id).');
            }
            $bindings['company_id'] = $companyId;
        }

        foreach (self::sessionVariables() as $name => $meta) {
            if (! str_contains($sql, ':'.$name)) {
                continue;
            }
            if (! array_key_exists($name, $sessionVariables) || $sessionVariables[$name] === null) {
                // Variable sin resolver para este visor: nunca ejecutar sin filtro, devolver vacio.
                return match ($type) {
                    DashboardWidget::TYPE_KPI => ['value' => 0],
                    DashboardWidget::TYPE_TABLE => ['columns' => [], 'rows' => []],
                    default => ['labels' => [], 'series' => []],
                };
            }
            $bindings[$name] = $sessionVariables[$name];
        }

        $rows = collect(DB::select($sql, $bindings))->take($this->maxRows());

        if ($rows->isEmpty()) {
            return match ($type) {
                DashboardWidget::TYPE_KPI => ['value' => 0],
                DashboardWidget::TYPE_TABLE => ['columns' => [], 'rows' => []],
                default => ['labels' => [], 'series' => []],
            };
        }

        $firstRow = (array) $rows->first();
        $keys = array_keys($firstRow);

        if ($type === DashboardWidget::TYPE_TABLE) {
            return [
                'columns' => $keys,
                'rows' => $rows->map(fn ($r) => (array) $r)->all(),
            ];
        }

        if ($type === DashboardWidget::TYPE_KPI) {
            $valueKey = $keys[0];

            return ['value' => (float) ($firstRow[$valueKey] ?? 0)];
        }

        // bar/line/pie: se espera primera columna = etiqueta, segunda = valor.
        $labelKey = $keys[0];
        $valueKey = $keys[1] ?? $keys[0];

        return [
            'labels' => $rows->pluck($labelKey)->map(fn ($v) => (string) $v)->all(),
            'series' => $rows->pluck($valueKey)->map(fn ($v) => (float) $v)->all(),
        ];
    }

    public function assertSqlSafe(string $sql): void
    {
        if ($sql === '') {
            throw new WidgetQueryException('La consulta SQL no puede estar vacia.');
        }

        if (! preg_match('/^select\b/i', $sql)) {
            throw new WidgetQueryException('La consulta SQL debe iniciar con SELECT.');
        }

        $withoutTrailingSemicolons = rtrim(rtrim($sql), ';');
        if (str_contains($withoutTrailingSemicolons, ';')) {
            throw new WidgetQueryException('Solo se permite una sola sentencia SQL (sin ; intermedios).');
        }

        foreach (self::FORBIDDEN_SQL_KEYWORDS as $word) {
            if (preg_match('/\b'.$word.'\b/i', $sql)) {
                throw new WidgetQueryException("La consulta contiene una palabra clave no permitida: {$word}.");
            }
        }
    }

    public static function sqlReferencesCompanyPlaceholder(string $sql): bool
    {
        return str_contains($sql, ':company_id');
    }

    // ------------------------------------------------------------------
    // Whitelist helpers (usados tambien por Form Requests de visibilidad)
    // ------------------------------------------------------------------

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function tables(): array
    {
        return (array) config('dashboard_builder.tables', []);
    }

    public static function isTableAllowed(string $table): bool
    {
        return array_key_exists($table, self::tables());
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function tableConfig(string $table): ?array
    {
        return self::tables()[$table] ?? null;
    }

    public static function tableHasCompanyScope(string $table): bool
    {
        return (bool) (self::tableConfig($table)['has_company_scope'] ?? false);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function sessionVariables(): array
    {
        return (array) config('dashboard_builder.session_variables', []);
    }

    public static function isSessionVariableAllowed(string $name): bool
    {
        return array_key_exists($name, self::sessionVariables());
    }

    /**
     * Valida la FORMA del query_definition contra la whitelist, sin ejecutar SQL.
     * Usado por los Form Requests al guardar un widget (modo guiado).
     *
     * @param  array<string, mixed>  $definition
     * @return list<string> errores encontrados (vacio si es valido)
     */
    public static function validateDefinitionShape(array $definition, string $type): array
    {
        $errors = [];
        $table = (string) ($definition['table'] ?? '');

        if (! self::isTableAllowed($table)) {
            return ['La tabla seleccionada no esta permitida.'];
        }

        $columns = self::tableConfig($table)['columns'] ?? [];

        if ($type === DashboardWidget::TYPE_TABLE) {
            $cols = $definition['columns'] ?? [];
            if (! is_array($cols) || $cols === []) {
                $errors[] = 'Selecciona al menos una columna para el widget de tabla.';
            } else {
                foreach ($cols as $c) {
                    if (! array_key_exists((string) $c, $columns)) {
                        $errors[] = "Columna no permitida: {$c}";
                    }
                }
            }
        } else {
            $metric = $definition['metric'] ?? null;
            if (! is_array($metric) || ! isset($metric['column'], $metric['aggregation'])) {
                $errors[] = 'Define la metrica (columna y agregacion).';
            } else {
                $col = (string) $metric['column'];
                if (! array_key_exists($col, $columns)) {
                    $errors[] = "Columna de metrica no permitida: {$col}";
                } elseif (empty($columns[$col]['aggregatable'])) {
                    $errors[] = "La columna {$col} no admite agregacion.";
                }
                if (! in_array(strtolower((string) $metric['aggregation']), self::ALLOWED_AGGREGATIONS, true)) {
                    $errors[] = 'Agregacion no permitida.';
                }
            }

            $groupBy = $definition['group_by'] ?? null;
            if ($type === DashboardWidget::TYPE_KPI && $groupBy) {
                $errors[] = 'Un widget KPI no admite agrupacion (group_by).';
            }
            if (is_array($groupBy) && isset($groupBy['column'])) {
                $groupColumn = (string) $groupBy['column'];
                if (! array_key_exists($groupColumn, $columns)) {
                    $errors[] = "Columna de agrupacion no permitida: {$groupColumn}";
                } elseif (empty($columns[$groupColumn]['groupable'])) {
                    $errors[] = "La columna {$groupColumn} no admite agrupacion.";
                }
            }
        }

        foreach ((array) ($definition['filters'] ?? []) as $filter) {
            if (! is_array($filter) || ! isset($filter['column'], $filter['operator'])) {
                continue;
            }
            $filterColumn = (string) $filter['column'];
            if (! array_key_exists($filterColumn, $columns)) {
                $errors[] = "Columna de filtro no permitida: {$filterColumn}";
            }
            if (! in_array(strtolower((string) $filter['operator']), self::ALLOWED_OPERATORS, true)) {
                $errors[] = 'Operador de filtro no permitido.';
            }
            if (($filter['value_type'] ?? 'literal') === 'variable' && ! self::isSessionVariableAllowed((string) ($filter['value'] ?? ''))) {
                $errors[] = "Variable de sesion no permitida: {$filter['value']}";
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $tableConfig
     */
    protected function assertColumnAllowed(array $tableConfig, string $column, ?string $capability = null): void
    {
        $columns = $tableConfig['columns'] ?? [];
        if (! array_key_exists($column, $columns)) {
            throw new WidgetQueryException("Columna no permitida: {$column}");
        }

        if ($capability !== null && empty($columns[$column][$capability])) {
            throw new WidgetQueryException("La columna {$column} no admite esta operacion ({$capability}).");
        }
    }

    protected function assertAggregationAllowed(string $aggregation): void
    {
        if (! in_array($aggregation, self::ALLOWED_AGGREGATIONS, true)) {
            throw new WidgetQueryException("Agregacion no permitida: {$aggregation}");
        }
    }

    protected function maxRows(): int
    {
        return (int) config('dashboard_builder.max_rows', 500);
    }
}
