<?php

namespace App\Services\Account;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sesiones abiertas de una cuenta, leidas de la tabla `sessions`.
 *
 * Solo funciona con el driver `database`, que es el que usa el proyecto. Con `file` o
 * `cookie` no hay nada que listar, y en vez de inventar filas la pantalla recibe una lista
 * vacia y un aviso: decir «no hay otras sesiones» cuando en realidad no se pueden ver
 * seria exactamente el error que esta seccion existe para evitar.
 */
class SessionInspector
{
    public function isSupported(): bool
    {
        return config('session.driver') === 'database';
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function forUser(User $user, ?string $currentSessionId = null): array
    {
        if (! $this->isSupported()) {
            return [];
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->limit(20)
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(function ($row) use ($currentSessionId) {
                $agent = (string) ($row->user_agent ?? '');
                $lastActivity = Carbon::createFromTimestamp((int) $row->last_activity);
                $isCurrent = $currentSessionId !== null && hash_equals((string) $row->id, $currentSessionId);

                return [
                    // El id de sesion no viaja al navegador: identifica la sesion y con el
                    // se podria intentar suplantarla. Basta un hash corto para la clave de React.
                    'key' => substr(hash('sha256', (string) $row->id), 0, 16),
                    'device' => $this->device($agent),
                    'browser' => $this->browser($agent),
                    'platform' => $this->platform($agent),
                    'ip_address' => $row->ip_address,
                    'location' => $this->location((string) ($row->ip_address ?? '')),
                    'last_activity' => $lastActivity->toIso8601String(),
                    'is_current' => $isCurrent,
                    // «Activa» es una sesion con actividad dentro de la vida de la sesion.
                    'is_active' => $lastActivity->gt(now()->subMinutes((int) config('session.lifetime', 120))),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Cierra todas las sesiones de la cuenta menos la actual.
     *
     * @return int cuantas se cerraron
     */
    public function destroyOthers(User $user, string $currentSessionId): int
    {
        if (! $this->isSupported()) {
            return 0;
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->where('id', '!=', $currentSessionId)
            ->delete();
    }

    // ------------------------------------------------------------------ lectura del agente

    protected function device(string $agent): string
    {
        if ($agent === '') {
            return 'Dispositivo desconocido';
        }

        if (preg_match('/iPad|Tablet/i', $agent)) {
            return 'Tableta';
        }

        if (preg_match('/Mobile|Android|iPhone|iPod/i', $agent)) {
            return 'Teléfono';
        }

        return 'Computador';
    }

    protected function browser(string $agent): string
    {
        // El orden importa: Edge y Opera se anuncian tambien como Chrome, y Chrome como
        // Safari. Comprobar primero el mas especifico evita etiquetarlos todos «Chrome».
        return match (true) {
            (bool) preg_match('/Edg/i', $agent) => 'Edge',
            (bool) preg_match('/OPR|Opera/i', $agent) => 'Opera',
            (bool) preg_match('/Firefox/i', $agent) => 'Firefox',
            (bool) preg_match('/Chrome|CriOS/i', $agent) => 'Chrome',
            (bool) preg_match('/Safari/i', $agent) => 'Safari',
            default => 'Navegador desconocido',
        };
    }

    protected function platform(string $agent): string
    {
        return match (true) {
            (bool) preg_match('/Windows/i', $agent) => 'Windows',
            (bool) preg_match('/iPhone|iPad|iPod/i', $agent) => 'iOS',
            (bool) preg_match('/Macintosh|Mac OS X/i', $agent) => 'macOS',
            (bool) preg_match('/Android/i', $agent) => 'Android',
            (bool) preg_match('/Linux/i', $agent) => 'Linux',
            default => 'Sistema desconocido',
        };
    }

    /**
     * Ubicacion aproximada.
     *
     * El proyecto no tiene base de geolocalizacion por IP ni debe llamar a un servicio
     * externo en cada carga del perfil, asi que se distingue lo unico que se puede afirmar
     * sin consultar nada: si la conexion viene de la propia maquina o de la red local.
     * Para el resto se muestra la IP, que es el dato real, en vez de una ciudad inventada.
     */
    protected function location(string $ip): string
    {
        if ($ip === '') {
            return 'Origen desconocido';
        }

        if (in_array($ip, ['127.0.0.1', '::1'], true)) {
            return 'Este equipo';
        }

        if (preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/', $ip)) {
            return 'Red local';
        }

        return $ip;
    }
}
