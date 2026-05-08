<?php

namespace App\Jobs;

use App\Models\DataImportBatch;
use App\Services\DataImport\BankImportStrategy;
use App\Services\DataImport\CompanyImportStrategy;
use App\Services\DataImport\DataImportContext;
use App\Services\DataImport\EmployeeUserImportStrategy;
use App\Services\DataImport\ImportStrategyInterface;
use App\Services\DataImport\OperationImportStrategy;
use App\Services\DataImport\ReferenceImportStrategy;
use App\Services\DataImport\RowImportException;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Reader;
use Throwable;

class ProcessDataImportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public int $batchId)
    {
        $this->onConnection((string) config('data_import.queue_connection', config('queue.default')));
    }

    public function handle(
        CompanyImportStrategy $companyStrategy,
        BankImportStrategy $bankStrategy,
        OperationImportStrategy $operationStrategy,
        ReferenceImportStrategy $referenceStrategy,
        EmployeeUserImportStrategy $employeeUserStrategy,
    ): void {
        $batch = DataImportBatch::query()->find($this->batchId);

        if (! $batch) {
            return;
        }

        $path = storage_path('app/'.$batch->stored_path);
        if (! is_readable($path)) {
            $this->failBatch($batch, 'Archivo no encontrado o ilegible.');

            return;
        }

        $meta = $batch->meta ?? [];
        $ctx = new DataImportContext(
            companyImportMode: is_string($meta['company_import_mode'] ?? null)
                ? (string) $meta['company_import_mode']
                : 'skip',
            employeeUpdateExisting: (bool) ($meta['employee_update_existing'] ?? false),
        );

        if ($batch->type !== DataImportBatch::TYPE_COMPANIES) {
            $ctx->warmCompanyMap();
        }

        $strategy = $this->resolveStrategy(
            $batch->type,
            $companyStrategy,
            $bankStrategy,
            $operationStrategy,
            $referenceStrategy,
            $employeeUserStrategy,
        );

        $batch->update([
            'status' => DataImportBatch::STATUS_PROCESSING,
            'started_at' => now(),
        ]);

        $errors = [];
        $success = 0;
        $failed = 0;
        $lineNumber = 1;

        try {
            $reader = Reader::createFromPath($path);
            $reader->setHeaderOffset(0);

            $records = $reader->getRecords();
            foreach ($records as $record) {
                $lineNumber++;
                if ($this->rowIsEmpty($record)) {
                    continue;
                }

                $row = $this->normalizeKeys($record);

                try {
                    DB::transaction(function () use ($strategy, $row, $lineNumber, $ctx): void {
                        $strategy->processRow($row, $lineNumber, $ctx);
                    });
                    $success++;
                } catch (RowImportException $e) {
                    $failed++;
                    $errors[] = [
                        'line' => $e->lineNumber ?: $lineNumber,
                        'message' => $e->getMessage(),
                    ];
                } catch (Throwable $e) {
                    $failed++;
                    $errors[] = [
                        'line' => $lineNumber,
                        'message' => $e->getMessage(),
                    ];
                    Log::warning('data_import_row_failed', [
                        'batch_id' => $batch->id,
                        'line' => $lineNumber,
                        'exception' => $e,
                    ]);
                }
            }
        } catch (Throwable $e) {
            $this->failBatch($batch, 'Error leyendo CSV: '.$e->getMessage());

            return;
        }

        $errorPath = null;
        if ($errors !== []) {
            $errorPath = 'import-errors/batch-'.$batch->id.'-'.uniqid().'.json';
            Storage::put($errorPath, json_encode($errors, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }

        $batch->update([
            'status' => DataImportBatch::STATUS_COMPLETED,
            'rows_success' => $success,
            'rows_failed' => $failed,
            'rows_total' => $success + $failed,
            'error_report_path' => $errorPath,
            'finished_at' => now(),
            'meta' => array_merge($meta, [
                'errors_count' => count($errors),
                'success_count' => $success,
            ]),
        ]);
    }

    protected function failBatch(DataImportBatch $batch, string $message): void
    {
        $batch->update([
            'status' => DataImportBatch::STATUS_FAILED,
            'finished_at' => now(),
            'meta' => array_merge($batch->meta ?? [], ['fatal_error' => $message]),
        ]);
        Log::error('data_import_failed', ['batch_id' => $batch->id, 'message' => $message]);
    }

    /**
     * @param  array<int|string, mixed>  $record
     */
    protected function rowIsEmpty(array $record): bool
    {
        foreach ($record as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<int|string, mixed>  $record
     * @return array<string, string|null>
     */
    protected function normalizeKeys($record): array
    {
        $out = [];
        foreach ($record as $k => $v) {
            $key = strtolower(trim((string) $k));
            if ($key === '') {
                continue;
            }
            $out[$key] = $v === null ? null : (string) $v;
        }

        return $out;
    }

    protected function resolveStrategy(
        string $type,
        CompanyImportStrategy $companyStrategy,
        BankImportStrategy $bankStrategy,
        OperationImportStrategy $operationStrategy,
        ReferenceImportStrategy $referenceStrategy,
        EmployeeUserImportStrategy $employeeUserStrategy,
    ): ImportStrategyInterface {
        return match ($type) {
            DataImportBatch::TYPE_COMPANIES => $companyStrategy,
            DataImportBatch::TYPE_BANKS => $bankStrategy,
            DataImportBatch::TYPE_OPERATIONS => $operationStrategy,
            DataImportBatch::TYPE_REFERENCES => $referenceStrategy,
            DataImportBatch::TYPE_EMPLOYEES_USERS => $employeeUserStrategy,
            default => throw new \InvalidArgumentException('Tipo de importacion no soportado.'),
        };
    }
}
