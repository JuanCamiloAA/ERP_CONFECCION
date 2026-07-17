<?php

namespace App\Services\DataImport;

use App\Models\DataImportBatch;
use App\Support\DataImportStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Reader;
use Throwable;

class DataImportProcessor
{
    public function __construct(
        protected CompanyImportStrategy $companyStrategy,
        protected BankImportStrategy $bankStrategy,
        protected OperationImportStrategy $operationStrategy,
        protected ReferenceImportStrategy $referenceStrategy,
        protected EmployeeUserImportStrategy $employeeUserStrategy,
    ) {}

    public function process(DataImportBatch $batch): void
    {
        if (! in_array($batch->status, [DataImportBatch::STATUS_PENDING, DataImportBatch::STATUS_FAILED], true)) {
            throw new \RuntimeException('Esta importacion ya fue procesada o esta en curso.');
        }

        $path = DataImportStorage::absolutePath($batch);
        if ($path === null || ! is_readable($path)) {
            $this->failBatch($batch, 'Archivo no encontrado o ilegible. Vuelva a cargar el CSV.');

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

        $strategy = $this->resolveStrategy($batch->type);

        $batch->update([
            'status' => DataImportBatch::STATUS_PROCESSING,
            'started_at' => now(),
            'finished_at' => null,
            'rows_total' => 0,
            'rows_success' => 0,
            'rows_failed' => 0,
            'error_report_path' => null,
        ]);

        $errors = [];
        $success = 0;
        $failed = 0;
        $lineNumber = 1;

        try {
            $reader = $this->openCsvReader($path);

            foreach ($reader->getRecords() as $record) {
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
    protected function normalizeKeys(array $record): array
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

    protected function resolveStrategy(string $type): ImportStrategyInterface
    {
        return match ($type) {
            DataImportBatch::TYPE_COMPANIES => $this->companyStrategy,
            DataImportBatch::TYPE_BANKS => $this->bankStrategy,
            DataImportBatch::TYPE_OPERATIONS => $this->operationStrategy,
            DataImportBatch::TYPE_REFERENCES => $this->referenceStrategy,
            DataImportBatch::TYPE_EMPLOYEES_USERS => $this->employeeUserStrategy,
            default => throw new \InvalidArgumentException('Tipo de importacion no soportado.'),
        };
    }

    protected function openCsvReader(string $path): Reader
    {
        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new \RuntimeException('No se pudo leer el contenido del CSV.');
        }

        $contents = preg_replace('/^\xEF\xBB\xBF/u', '', $contents) ?? $contents;

        $reader = Reader::createFromString($contents);
        $reader->setHeaderOffset(0);

        return $reader;
    }
}
