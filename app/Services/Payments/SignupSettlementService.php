<?php

namespace App\Services\Payments;

use App\Models\CompanySignup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Cierra un alta segun lo que diga la transaccion de Wompi.
 *
 * Dos caminos llegan aqui —el webhook y la vuelta del checkout— y pueden llegar a la vez.
 * Por eso todo ocurre dentro de una transaccion con la fila bloqueada (`lockForUpdate`):
 * el primero que entra la deja en `pagado` y el segundo se encuentra un alta que ya no
 * esta pendiente y no hace nada. Sin ese bloqueo, un webhook rapido y un usuario impaciente
 * crearian la empresa dos veces.
 */
class SignupSettlementService
{
    public function __construct(protected CompanyProvisioner $provisioner) {}

    /**
     * @param  array<string, mixed>  $transaction  transaccion tal como la devuelve la API
     * @return CompanySignup|null  el alta actualizada, o null si no habia nada que hacer
     */
    public function settle(string $reference, array $transaction): ?CompanySignup
    {
        $status = (string) ($transaction['status'] ?? '');
        $transactionId = (string) ($transaction['id'] ?? '');

        return DB::transaction(function () use ($reference, $transaction, $status, $transactionId) {
            $signup = CompanySignup::query()
                ->where('reference', $reference)
                ->lockForUpdate()
                ->first();

            if ($signup === null || ! $signup->isPending()) {
                return $signup;
            }

            $signup->transaction_id = $transactionId ?: $signup->transaction_id;
            $signup->transaction_status = $status;

            if ($status !== WompiService::STATUS_APPROVED) {
                // Declinada, anulada o con error: el alta queda fallida y se puede
                // reintentar desde cero con el mismo correo, porque no se creo nada.
                if (in_array($status, [
                    WompiService::STATUS_DECLINED,
                    WompiService::STATUS_VOIDED,
                    WompiService::STATUS_ERROR,
                ], true)) {
                    $signup->status = CompanySignup::STATUS_FAILED;
                }

                $signup->save();

                return $signup;
            }

            // Aprobada, pero no basta con que lo diga: tiene que ser por el importe y la
            // moneda que se pidieron. Si no cuadran, no se da de alta y queda registrado.
            $paid = (int) ($transaction['amount_in_cents'] ?? 0);
            $currency = (string) ($transaction['currency'] ?? '');

            if ($paid < $signup->amount_in_cents || $currency !== $signup->currency) {
                Log::warning('Wompi: transaccion aprobada con importe o moneda que no cuadran.', [
                    'reference' => $reference,
                    'transaction_id' => $transactionId,
                    'esperado' => $signup->amount_in_cents.' '.$signup->currency,
                    'recibido' => $paid.' '.$currency,
                ]);

                $signup->status = CompanySignup::STATUS_FAILED;
                $signup->save();

                return $signup;
            }

            $signup->paid_at = now();
            $signup->save();

            $this->provisioner->fromSignup($signup);

            return $signup->refresh();
        });
    }
}
