<?php

namespace App\Services\Landing;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * Ejecuta la consulta escrita por el super usuario para un bloque de datos de la landing.
 *
 * La landing es PUBLICA: lo que salga de aqui lo ve cualquiera sin iniciar sesion. Por eso
 * la consulta pasa por varios candados antes de tocar la base de datos:
 *
 *   1. Una sola sentencia, y tiene que empezar por SELECT.
 *   2. Nada de comentarios SQL (esconden el resto de la sentencia).
 *   3. Tablas y columnas sensibles vetadas: nomina, empleados, usuarios, anticipos, claves.
 *   4. Construcciones peligrosas vetadas: escritura a disco, lectura de ficheros,
 *      catalogos del motor y funciones de espera.
 *   5. LIMIT obligatorio y acotado.
 *
 * Los candados son defensa en profundidad, no una garantia matematica: la ultima linea de
 * defensa sigue siendo que el super usuario revise la vista previa antes de publicar.
 */
class SafeQueryRunner
{
    public const MAX_ROWS = 50;

    /**
     * Tablas cuyo contenido no puede acabar en una pagina publica.
     */
    private const BLOCKED_TABLES = [
        'users', 'employees', 'payrolls', 'payroll_employees', 'payroll_details',
        'advances', 'productions', 'expenses', 'banks', 'access_logs',
        'password_reset_tokens', 'sessions', 'personal_access_tokens',
        'permissions', 'roles', 'model_has_roles', 'model_has_permissions',
        'role_has_permissions', 'jobs', 'failed_jobs', 'migrations',
    ];

    /**
     * Palabras que no tienen ningun uso legitimo aqui.
     */
    private const BLOCKED_TOKENS = [
        'password', 'remember_token', 'document_number', 'bank_account_number',
        'base_salary', 'daily_salary', 'api_token', 'secret', 'credentials',
        'information_schema', 'performance_schema', 'mysql.', 'pg_',
        'into outfile', 'into dumpfile', 'load_file', 'load data',
        'benchmark(', 'sleep(', 'get_lock(',
    ];

    /**
     * @return list<array<string, mixed>>
     *
     * @throws RuntimeException con un mensaje legible para el editor.
     */
    public function run(string $sql): array
    {
        $prepared = $this->guard($sql);

        try {
            $rows = DB::select($prepared);
        } catch (Throwable $e) {
            throw new RuntimeException('La consulta falló: '.$e->getMessage());
        }

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Aplica los candados y devuelve la consulta lista para ejecutar.
     *
     * @throws RuntimeException
     */
    public function guard(string $sql): string
    {
        $clean = trim($sql);

        if ($clean === '') {
            throw new RuntimeException('Escribe una consulta.');
        }

        // Los comentarios pueden ocultar el resto de la sentencia; fuera antes de mirar nada.
        if (preg_match('/(--|#|\/\*)/', $clean)) {
            throw new RuntimeException('No se admiten comentarios SQL en la consulta.');
        }

        // Un solo SELECT: se tolera el punto y coma final, nada mas.
        $clean = rtrim($clean, "; \t\n\r");
        if (str_contains($clean, ';')) {
            throw new RuntimeException('Solo se admite una sentencia.');
        }

        $lower = mb_strtolower($clean);

        if (! str_starts_with($lower, 'select ')) {
            throw new RuntimeException('La consulta debe empezar por SELECT (solo lectura).');
        }

        foreach (self::BLOCKED_TOKENS as $token) {
            if (str_contains($lower, $token)) {
                throw new RuntimeException('La consulta usa un elemento no permitido: "'.$token.'".');
            }
        }

        foreach (self::BLOCKED_TABLES as $table) {
            // \b evita que "users" bloquee tablas legitimas que lo contengan como fragmento.
            if (preg_match('/\b'.preg_quote($table, '/').'\b/', $lower)) {
                throw new RuntimeException('La tabla "'.$table.'" no puede publicarse en la landing.');
            }
        }

        return $this->withBoundedLimit($clean, $lower);
    }

    /**
     * Fuerza un LIMIT y lo acota, para que un descuido no vuelque una tabla entera.
     */
    private function withBoundedLimit(string $sql, string $lower): string
    {
        if (! preg_match('/\blimit\s+(\d+)\s*$/', $lower, $m)) {
            return $sql.' LIMIT '.self::MAX_ROWS;
        }

        if ((int) $m[1] > self::MAX_ROWS) {
            return preg_replace('/\blimit\s+\d+\s*$/i', 'LIMIT '.self::MAX_ROWS, $sql) ?? $sql;
        }

        return $sql;
    }
}
