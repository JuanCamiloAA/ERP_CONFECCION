<?php

namespace App\Jobs;

use App\Models\DataImportBatch;
use App\Services\DataImport\DataImportProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * @deprecated Las importaciones se procesan de forma sincrona desde el panel (boton Procesar).
 *             Se conserva por compatibilidad con jobs antiguos en cola.
 */
class ProcessDataImportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public int $batchId) {}

    public function handle(DataImportProcessor $processor): void
    {
        $batch = DataImportBatch::query()->find($this->batchId);

        if ($batch) {
            $processor->process($batch);
        }
    }
}
