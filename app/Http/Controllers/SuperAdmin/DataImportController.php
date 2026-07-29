<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreDataImportRequest;
use App\Models\DataImportBatch;
use App\Services\DataImport\DataImportCsvPreview;
use App\Services\DataImport\DataImportProcessor;
use App\Services\DataImport\TemplateGeneratorService;
use App\Support\DataImportStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class DataImportController extends Controller
{
    public function __construct(
        protected TemplateGeneratorService $templates,
        protected DataImportProcessor $processor,
    ) {}

    public function index(Request $request): Response
    {
        $batches = DataImportBatch::query()
            ->with('user:id,name,last_name')
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('SuperAdmin/DataImports/Index', [
            'batches' => $batches,
            'types' => [
                DataImportBatch::TYPE_COMPANIES => 'Empresas',
                DataImportBatch::TYPE_BANKS => 'Bancos',
                DataImportBatch::TYPE_OPERATIONS => 'Operaciones',
                DataImportBatch::TYPE_REFERENCES => 'Referencias',
                DataImportBatch::TYPE_EMPLOYEES_USERS => 'Empleados y usuarios',
            ],
            ...$this->csvPreviewProps($request),
        ]);
    }

    /**
     * @return array{csvPreview: ?array, csvPreviewError: ?string}
     */
    protected function csvPreviewProps(Request $request): array
    {
        if (! $request->filled('preview')) {
            return ['csvPreview' => null, 'csvPreviewError' => null];
        }

        $batch = DataImportBatch::query()->find($request->integer('preview'));
        if (! $batch) {
            return ['csvPreview' => null, 'csvPreviewError' => 'Importacion no encontrada.'];
        }

        $built = $this->buildCsvPreviewPayload($batch);
        if (isset($built['error'])) {
            return ['csvPreview' => null, 'csvPreviewError' => $built['error']];
        }

        return ['csvPreview' => $built['preview'], 'csvPreviewError' => null];
    }

    /**
     * @return array{preview: array<string, mixed>}|array{error: string}
     */
    protected function buildCsvPreviewPayload(DataImportBatch $batch): array
    {
        $contents = DataImportStorage::readCsvContents($batch);
        if ($contents === null || $contents === '') {
            return ['error' => 'Archivo no encontrado o ilegible. Vuelva a cargar el CSV.'];
        }

        try {
            $parsed = DataImportCsvPreview::fromContents($contents, 50);
        } catch (\Throwable $e) {
            report($e);

            return ['error' => 'No se pudo leer el CSV. Use UTF-8 y los mismos encabezados que la plantilla.'];
        }

        return [
            'preview' => [
                ...$parsed,
                'batch_id' => $batch->id,
                'filename' => $batch->original_filename,
                'type' => $batch->type,
            ],
        ];
    }

    public function show(DataImportBatch $batch): Response
    {
        $errors = [];
        $maxShow = 200;
        $decoded = null;

        if ($batch->error_report_path && Storage::disk(DataImportStorage::diskName())->exists($batch->error_report_path)) {
            $raw = Storage::disk(DataImportStorage::diskName())->get($batch->error_report_path);
            $decoded = json_decode((string) $raw, true);
            if (is_array($decoded)) {
                $errors = array_slice($decoded, 0, $maxShow);
            }
        }

        return Inertia::render('SuperAdmin/DataImports/Show', [
            'batch' => $batch->loadMissing('user:id,name,last_name,email'),
            'errors_preview' => $errors,
            'errors_truncated' => is_array($decoded) && count($decoded) > $maxShow,
            'errors_total' => is_array($decoded) ? count($decoded) : 0,
        ]);
    }

    public function downloadTemplate(string $type)
    {
        if (! in_array($type, DataImportBatch::types(), true)) {
            abort(404);
        }

        $content = $this->templates->csvContent($type);
        $name = $this->templates->filenameForType($type);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    public function downloadTemplatesZip(): BinaryFileResponse
    {
        $tmp = tempnam(sys_get_temp_dir(), 'zip_import_');
        if ($tmp === false) {
            abort(500, 'No se pudo crear archivo temporal.');
        }

        $zip = new ZipArchive;
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            @unlink($tmp);
            abort(500, 'No se pudo crear ZIP.');
        }

        foreach (DataImportBatch::types() as $type) {
            $zip->addFromString(
                $this->templates->filenameForType($type),
                $this->templates->csvContent($type),
            );
        }
        $zip->addFromString('LEEME_IMPORTACION.md', $this->templates->readmeMarkdown());
        $zip->close();

        return response()->download($tmp, 'plantillas_importacion.zip', [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    public function downloadErrors(DataImportBatch $batch): BinaryFileResponse|RedirectResponse
    {
        if (! $batch->error_report_path || ! Storage::disk(DataImportStorage::diskName())->exists($batch->error_report_path)) {
            return back()->with('warning', 'No hay reporte de errores para esta importacion.');
        }

        return Storage::disk(DataImportStorage::diskName())->download($batch->error_report_path, 'errores_import_'.$batch->id.'.json');
    }

    public function store(StoreDataImportRequest $request): RedirectResponse
    {
        $this->ensureImportRateLimitNotExceeded($request);

        $file = $request->file('file');
        $uuid = Str::uuid()->toString();
        $filename = $uuid.'.csv';
        $storedPath = DataImportStorage::storeUploadedCsv($file, $filename);

        $meta = [
            'company_import_mode' => $request->input('company_import_mode', 'skip'),
            'employee_update_existing' => $request->boolean('employee_update_existing'),
        ];

        $batch = DataImportBatch::create([
            'user_id' => $request->user()->id,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'type' => $request->validated('type'),
            'status' => DataImportBatch::STATUS_PENDING,
            'meta' => $meta,
            'ip_address' => $request->ip(),
        ]);

        return back()->with('success', 'Archivo cargado. Pulsa «Procesar» en el historial para ejecutar la importacion.');
    }

    public function process(Request $request, DataImportBatch $batch): RedirectResponse
    {
        if ($batch->status === DataImportBatch::STATUS_PROCESSING) {
            return back()->with('warning', 'Esta importacion ya se esta procesando.');
        }

        if (! in_array($batch->status, [DataImportBatch::STATUS_PENDING, DataImportBatch::STATUS_FAILED], true)) {
            return back()->with('warning', 'Solo se pueden procesar importaciones pendientes o fallidas.');
        }

        try {
            $this->processor->process($batch->fresh());
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'No se pudo procesar la importacion: '.$e->getMessage());
        }

        $batch->refresh();

        if ($batch->status === DataImportBatch::STATUS_FAILED) {
            $fatal = is_array($batch->meta) ? ($batch->meta['fatal_error'] ?? null) : null;

            return back()->with('error', $fatal ?: 'La importacion fallo. Revisa el detalle.');
        }

        $message = "Importacion completada: {$batch->rows_success} filas OK";
        if ($batch->rows_failed > 0) {
            $message .= ", {$batch->rows_failed} con error";
        }

        return back()->with('success', $message.'.');
    }

    public function preview(DataImportBatch $batch): JsonResponse
    {
        $built = $this->buildCsvPreviewPayload($batch);
        if (isset($built['error'])) {
            return response()->json(['message' => $built['error']], 404);
        }

        return response()->json($built['preview']);
    }

    public function downloadFile(DataImportBatch $batch): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $contents = DataImportStorage::readCsvContents($batch);
        if ($contents === null || $contents === '') {
            return back()->with('warning', 'No se pudo descargar el archivo CSV.');
        }

        $name = $batch->original_filename ?: ('import_'.$batch->id.'.csv');
        $safeName = str_replace(['"', "\r", "\n"], '', $name);

        return response($contents, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$safeName.'"',
        ]);
    }

    public function destroy(DataImportBatch $batch): RedirectResponse
    {
        if ($batch->status === DataImportBatch::STATUS_PROCESSING) {
            return back()->with('warning', 'No se puede eliminar una importacion en curso.');
        }

        DataImportStorage::deleteBatchArtifacts($batch);
        $batch->delete();

        return back()->with('success', 'Importacion eliminada del historial.');
    }

    /**
     * Throttle tras validar el CSV: intentos fallidos (tipo/MIME) no consumen cupo.
     */
    protected function ensureImportRateLimitNotExceeded(StoreDataImportRequest $request): void
    {
        $perMinute = max(1, (int) config('data_import.rate_limit_per_minute', 30));
        $userId = $request->user()?->id;
        $key = $userId ? 'data-import:user:'.$userId : 'data-import:ip:'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, $perMinute)) {
            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'file' => "Demasiados intentos de importacion. Espera {$seconds} segundos e intenta de nuevo.",
            ]);
        }

        RateLimiter::hit($key, 60);
    }
}
