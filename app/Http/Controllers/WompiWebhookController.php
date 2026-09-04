<?php

namespace App\Http\Controllers;

use App\Services\Payments\PaymentGatewayResolver;
use App\Services\Payments\SignupSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Recibe los eventos de Wompi.
 *
 * Es una ruta publica y sin sesion, asi que aqui no se cree nada de lo que llega:
 *
 * 1. Se valida la firma del evento contra el secreto de eventos. Sin eso, cualquiera que
 *    conozca la URL podria mandar un `APPROVED` y darse de alta una empresa gratis.
 * 2. Aun con la firma correcta, el estado y el importe se releen de la API de Wompi. La
 *    firma prueba quien lo envia, no que el cuerpo siga siendo la ultima verdad.
 *
 * Siempre responde 200 salvo que la firma no cuadre: Wompi reintenta ante cualquier otra
 * cosa, y reintentar no arregla un evento que ya se proceso o que no nos corresponde.
 */
class WompiWebhookController extends Controller
{
    public function __construct(
        protected PaymentGatewayResolver $gateways,
        protected SignupSettlementService $settlements,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $wompi = $this->gateways->wompi();
        $payload = $request->all();

        if (! $wompi->verifyEventSignature($payload)) {
            // 401 y no 200: que Wompi lo marque como fallido es justo lo que se quiere si
            // el secreto esta mal configurado.
            Log::warning('Wompi: evento con firma invalida.', [
                'event' => $payload['event'] ?? null,
                'ip' => $request->ip(),
            ]);

            return response()->json(['message' => 'Firma inválida.'], 401);
        }

        if (($payload['event'] ?? null) !== 'transaction.updated') {
            return response()->json(['message' => 'Evento ignorado.']);
        }

        $transaction = $payload['data']['transaction'] ?? null;
        $transactionId = is_array($transaction) ? ($transaction['id'] ?? null) : null;
        $reference = is_array($transaction) ? ($transaction['reference'] ?? null) : null;

        if (! is_string($transactionId) || ! is_string($reference)) {
            return response()->json(['message' => 'Evento sin transacción utilizable.']);
        }

        // La fuente de verdad es la API, no el cuerpo del evento.
        $fresh = $wompi->fetchTransaction($transactionId);

        if ($fresh === null) {
            // No se pudo confirmar: se devuelve 503 para que Wompi reintente mas tarde.
            return response()->json(['message' => 'No se pudo verificar la transacción.'], 503);
        }

        if (($fresh['reference'] ?? null) !== $reference) {
            Log::warning('Wompi: la referencia del evento no coincide con la de la API.', [
                'transaction_id' => $transactionId,
            ]);

            return response()->json(['message' => 'Referencia inconsistente.']);
        }

        $this->settlements->settle($reference, $fresh);

        return response()->json(['message' => 'Recibido.']);
    }
}
