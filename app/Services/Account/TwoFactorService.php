<?php

namespace App\Services\Account;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use PragmaRX\Google2FA\Google2FA;

/**
 * Verificacion en dos pasos (TOTP, RFC 6238).
 *
 * El alta tiene dos tiempos a proposito: `generateSecret` deja el secreto guardado pero
 * SIN confirmar, y hasta que `confirm` no valida un codigo real la cuenta sigue entrando
 * solo con contrasena. Sin ese segundo paso, alguien que escanea mal el QR se queda fuera
 * de su propia cuenta en el siguiente inicio de sesion.
 *
 * Los codigos de respaldo se guardan cifrados y se consumen de uno en uno: son la unica
 * salida cuando se pierde el telefono, y reutilizables no serian una salida sino otra
 * contrasena.
 */
class TwoFactorService
{
    /** Margen de deriva del reloj, en ventanas de 30 s hacia atras y hacia delante. */
    protected const WINDOW = 1;

    protected const RECOVERY_CODE_COUNT = 8;

    public function __construct(protected Google2FA $google2fa) {}

    /**
     * Crea el secreto y los codigos de respaldo y los deja sin confirmar.
     *
     * @return array{secret: string, qr: string, uri: string, recovery_codes: list<string>}
     */
    public function generateSecret(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey(32);
        $codes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => $codes,
            'two_factor_confirmed_at' => null,
        ])->save();

        return [
            'secret' => $secret,
            'uri' => $this->uriFor($user, $secret),
            'qr' => $this->qrSvg($this->uriFor($user, $secret)),
            'recovery_codes' => $codes,
        ];
    }

    /**
     * Confirma el alta con un codigo del autenticador.
     *
     * @return bool false si el codigo no es valido; el estado no cambia.
     */
    public function confirm(User $user, string $code): bool
    {
        if ($user->two_factor_secret === null) {
            return false;
        }

        if (! $this->verifyTotp($user->two_factor_secret, $code)) {
            return false;
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        return true;
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    /**
     * Verifica un codigo del autenticador O uno de respaldo.
     *
     * El de respaldo se consume: si vuelve a usarse ya no vale.
     */
    public function verify(User $user, string $code): bool
    {
        $code = trim($code);

        if ($code === '' || $user->two_factor_secret === null) {
            return false;
        }

        if ($this->verifyTotp($user->two_factor_secret, $code)) {
            return true;
        }

        return $this->consumeRecoveryCode($user, $code);
    }

    /** Regenera los codigos de respaldo; los anteriores dejan de servir. */
    public function regenerateRecoveryCodes(User $user): array
    {
        $codes = $this->generateRecoveryCodes();

        $user->forceFill(['two_factor_recovery_codes' => $codes])->save();

        return $codes;
    }

    /** @return list<string> */
    public function recoveryCodes(User $user): array
    {
        $codes = $user->two_factor_recovery_codes;

        return is_array($codes) ? array_values($codes) : [];
    }

    // ------------------------------------------------------------------ internos

    protected function verifyTotp(string $secret, string $code): bool
    {
        // Solo digitos: el usuario suele pegarlo con el espacio que muestra la app.
        $code = preg_replace('/\D/', '', $code) ?? '';

        if (strlen($code) !== 6) {
            return false;
        }

        try {
            return (bool) $this->google2fa->verifyKey($secret, $code, self::WINDOW);
        } catch (\Throwable) {
            // Un secreto corrupto no debe tumbar el inicio de sesion: se trata como fallo.
            return false;
        }
    }

    protected function consumeRecoveryCode(User $user, string $code): bool
    {
        $codes = $this->recoveryCodes($user);
        $normalized = strtoupper(trim($code));

        $index = array_search($normalized, array_map('strtoupper', $codes), true);

        if ($index === false) {
            return false;
        }

        unset($codes[$index]);

        $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

        return true;
    }

    /** @return list<string> */
    protected function generateRecoveryCodes(): array
    {
        $codes = [];

        for ($i = 0; $i < self::RECOVERY_CODE_COUNT; $i++) {
            $codes[] = $this->randomCode().'-'.$this->randomCode();
        }

        return $codes;
    }

    /** Sin I, O, 0 ni 1: se confunden al copiarlos a mano desde el papel. */
    protected function randomCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $out = '';

        for ($i = 0; $i < 5; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $out;
    }

    protected function uriFor(User $user, string $secret): string
    {
        return $this->google2fa->getQRCodeUrl(
            (string) config('app.name'),
            (string) $user->email,
            $secret,
        );
    }

    /**
     * QR en SVG embebido, no una imagen remota: el QR lleva el secreto dentro y no tiene
     * por que pasar por un servidor de terceros como hacen las APIs de graficos.
     */
    protected function qrSvg(string $uri): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(220, 1), new SvgImageBackEnd));

        return $writer->writeString($uri);
    }
}
