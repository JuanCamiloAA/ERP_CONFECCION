<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreDataImportRequest;
use App\Models\DataImportBatch;
use App\Models\DataImportFieldPreset;
use App\Services\DataImport\DataImportCsvPreview;
use App\Services\DataImport\DataImportProcessor;
use App\Services\DataImport\ImportFieldCatalog;
use App\Services\DataImport\TemplateGeneratorService;
use App\Support\DataImportStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use League\Csv\Bom;
use League\Csv\Reader;
use League\Csv\Writer;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use ZipArchive;

class DataImportController extends Controller
{
    public function __construct(
        protected TemplateGeneratorService $templates,
        protected DataImportProcessor $processor,
        protected ImportFieldCatalog $catalog,
    ) {}

    public function index(Request $request): Response
    {
        $filtros = [
            'q' => trim((string) $request->query('q', '')),
            'estado' => (string) $request->query('estado', 'todos'),
            'tipo' => (string) $request->query('tipo', ''),
        ];

        $batches = DataImportBatch::query()
            ->with('user:id,name,last_name')
            ->when($filtros['q'] !== '', function ($q) use ($filtros) {
                $t = '%'.$filtros['q'].'%';
                $q->where(function ($w) use ($t) {
                    $w->where('original_filename', 'like', $t)
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $t)->orWhere('last_name', 'like', $t));
                });
            })
            ->when($filtros['estado'] === 'errores', fn ($q) => $q->where('rows_failed', '>', 0))
            ->when($filtros['estado'] === 'pendientes', fn ($q) => $q->whereIn('status', [
                DataImportBatch::STATUS_PENDING,
                DataImportBatch::STATUS_PROCESSING,
            ]))
            ->when(in_array($filtros['tipo'], DataImportBatch::types(), true), fn ($q) => $q->where('type', $filtros['tipo']))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('SuperAdmin/DataImports/Index', [
            'batches' => $batches,
            'filters' => $filtros,
            'types' => [
                DataImportBatch::TYPE_COMPANIES => 'Empresas',
                DataImportBatch::TYPE_BANKS => 'Bancos',
                DataImportBatch::TYPE_OPERATIONS => 'Operaciones',
                DataImportBatch::TYPE_REFERENCES => 'Referencias',
                DataImportBatch::TYPE_REFERENCE_OPERATIONS => 'Operaciones de referencia',
                DataImportBatch::TYPE_EMPLOYEES_USERS => 'Empleados y usuarios',
            ],
            // Campos que admite cada plantilla, leidos de la tabla: con esto la pantalla
            // arma el selector y sabe cuales no se pueden desmarcar.
            'fieldCatalog' => $this->catalog->all(),
            'latestByType' => $this->latestBatchByType(),
            'fieldPresets' => $this->presetsForUser($request),
            'maxUploadKb' => (int) config('data_import.max_upload_kb', 5120),
            ...$this->csvPreviewProps($request),
        ]);
    }

    /**
     * Ultimo lote de cada tipo, para que la fila de la entidad muestre en que va.
     *
     * Es una prop nueva: si la pantalla no la usa, no cambia nada de lo que ya existia.
     *
     * @return array<string, DataImportBatch>
     */
    protected function latestBatchByType(): array
    {
        return DataImportBatch::query()
            ->select('id', 'type', 'status', 'rows_total', 'rows_success', 'rows_failed', 'original_filename', 'created_at', 'error_report_path', 'meta')
            ->whereIn('id', function ($q) {
                $q->selectRaw('MAX(id)')->from('data_import_batches')->groupBy('type');
            })
            ->get()
            ->keyBy('type')
            ->all();
    }

    /**
     * Presets de campos del usuario, mas los que otros hayan compartido.
     *
     * @return array<string, list<array{id: int, name: string, fields: list<string>, is_shared: bool, is_own: bool}>>
     */
    protected function presetsForUser(Request $request): array
    {
        $userId = (int) ($request->user()?->id ?? 0);

        $presets = DataImportFieldPreset::query()
            ->where(fn ($q) => $q->where('user_id', $userId)->orWhere('is_shared', true))
            ->orderBy('name')
            ->get();

        $porTipo = [];

        foreach ($presets as $preset) {
            // Se filtra contra el catalogo vivo: si una columna desaparecio de la tabla,
            // el preset sigue sirviendo con el resto en vez de romper la descarga.
            $validas = array_map(fn (array $campo) => $campo['key'], $this->catalog->fields($preset->type));
            $campos = array_values(array_intersect((array) $preset->fields, $validas));

            $porTipo[$preset->type][] = [
                'id' => (int) $preset->id,
                'name' => (string) $preset->name,
                'fields' => $campos,
                'is_shared' => (bool) $preset->is_shared,
                'is_own' => (int) $preset->user_id === $userId,
            ];
        }

        return $porTipo;
    }

    /**
     * Cabecera y numero de filas del CSV recien subido, sin procesarlo.
     *
     * Sirve para que la pantalla diga «188 filas» antes de importar y, sobre todo, para
     * avisar de columnas que no existen en la plantilla: hoy se ignoran en silencio y el
     * usuario cree haberlas cargado. Es solo aviso, nunca bloquea la carga.
     *
     * @return array{rows_detected: int, headers: list<string>, headers_unknown: list<string>}
     */
    protected function inspectUploadedCsv(UploadedFile $file, string $type): array
    {
        $vacio = ['rows_detected' => 0, 'headers' => [], 'headers_unknown' => []];

        try {
            $contenido = (string) $file->get();
        } catch (\Throwable) {
            return $vacio;
        }

        if (trim($contenido) === '') {
            return $vacio;
        }

        try {
            $reader = Reader::createFromString(preg_replace('/^\xEF\xBB\xBF/u', '', $contenido) ?? $contenido);
            $reader->setHeaderOffset(0);
            $cabecera = array_values(array_filter(
                array_map(fn ($h) => strtolower(trim((string) $h)), $reader->getHeader()),
                fn ($h) => $h !== '',
            ));
        } catch (\Throwable) {
            return $vacio;
        }

        $conocidas = array_map(fn (array $campo) => $campo['key'], $this->catalog->fields($type));

        return [
            // Se descuenta la cabecera contando saltos; una ultima linea sin salto final
            // no se pierde porque el rtrim solo quita los del final del archivo.
            'rows_detected' => max(0, substr_count(rtrim($contenido, "\r\n"), "\n")),
            'headers' => $cabecera,
            'headers_unknown' => array_values(array_diff($cabecera, $conocidas)),
        ];
    }

    /**
     * Campos pedidos para una plantilla: llegan como lista separada por comas. Vacio
     * significa «todos», que es lo que hacia el modulo antes de existir el selector.
     *
     * @return list<string>|null
     */
    protected function requestedFields(mixed $fields): ?array
    {
        if (! is_string($fields) || trim($fields) === '') {
            return null;
        }

        $keys = array_values(array_filter(array_map('trim', explode(',', $fields))));

        return $keys === [] ? null : $keys;
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

    public function downloadTemplate(Request $request, string $type)
    {
        if (! in_array($type, DataImportBatch::types(), true)) {
            abort(404);
        }

        $content = $this->templates->csvContent($type, $this->requestedFields($request->query('fields')));
        $name = $this->templates->filenameForType($type);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    public function downloadTemplatesZip(Request $request): BinaryFileResponse
    {
        // La pantalla manda la seleccion de cada tipo como fields[tipo]=a,b,c; lo que no
        // venga sale con todos sus campos.
        $seleccion = $request->query('fields');
        $seleccion = is_array($seleccion) ? $seleccion : [];

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
                $this->templates->csvContent($type, $this->requestedFields($seleccion[$type] ?? null)),
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

    /**
     * El CSV original recortado a las filas que fallaron, con el motivo al final.
     *
     * Es lo que hace falta para corregir: el archivo completo obliga a buscar las filas
     * malas a mano. La columna `_motivo_error` hay que quitarla antes de volver a subir
     * —el importador la ignora, pero conviene no arrastrarla.
     */
    public function downloadErrorRows(DataImportBatch $batch): RedirectResponse|SymfonyResponse
    {
        $disk = Storage::disk(DataImportStorage::diskName());

        if (! $batch->error_report_path || ! $disk->exists($batch->error_report_path)) {
            return back()->with('warning', 'No hay filas con error para descargar.');
        }

        $contents = DataImportStorage::readCsvContents($batch);
        if ($contents === null || $contents === '') {
            return back()->with('warning', 'El CSV original ya no esta disponible.');
        }

        $reporte = json_decode((string) $disk->get($batch->error_report_path), true);
        if (! is_array($reporte) || $reporte === []) {
            return back()->with('warning', 'No hay filas con error para descargar.');
        }

        $motivos = [];
        foreach ($reporte as $error) {
            $linea = (int) ($error['line'] ?? 0);
            if ($linea > 0 && ! isset($motivos[$linea])) {
                $motivos[$linea] = (string) ($error['message'] ?? '');
            }
        }

        try {
            $reader = Reader::createFromString(preg_replace('/^\xEF\xBB\xBF/u', '', $contents) ?? $contents);
            $reader->setHeaderOffset(0);
            $cabecera = $reader->getHeader();
        } catch (\Throwable $e) {
            return back()->with('error', 'No se pudo leer el CSV original: '.$e->getMessage());
        }

        $writer = Writer::createFromString();
        $writer->setOutputBOM(Bom::Utf8);
        $writer->insertOne([...$cabecera, '_motivo_error']);

        // El procesador cuenta la cabecera como linea 1, asi que la primera fila de datos
        // es la 2: se lleva el mismo contador para que las lineas coincidan con el reporte.
        $linea = 1;
        $escritas = 0;
        foreach ($reader->getRecords() as $record) {
            $linea++;
            if (! isset($motivos[$linea])) {
                continue;
            }
            $writer->insertOne([...array_values($record), $motivos[$linea]]);
            $escritas++;
        }

        if ($escritas === 0) {
            return back()->with('warning', 'No se encontraron en el archivo las filas del reporte de errores.');
        }

        return response($writer->toString(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="errores_lote_'.$batch->id.'.csv"',
        ]);
    }

    public function store(StoreDataImportRequest $request): RedirectResponse
    {
        $this->ensureImportRateLimitNotExceeded($request);

        $file = $request->file('file');
        $type = $request->validated('type');

        // Se lee antes de guardarlo: storeUploadedCsv mueve el temporal y despues ya no
        // hay de donde leer sin volver a bajarlo del disco (o de Firebase).
        $inspeccion = $this->inspectUploadedCsv($file, $type);

        $uuid = Str::uuid()->toString();
        $filename = $uuid.'.csv';
        $storedPath = DataImportStorage::storeUploadedCsv($file, $filename);

        $meta = array_merge([
            'company_import_mode' => $request->input('company_import_mode', 'skip'),
            'employee_update_existing' => $request->boolean('employee_update_existing'),
            'file_size' => $file->getSize(),
        ], $inspeccion);

        $batch = DataImportBatch::create([
            'user_id' => $request->user()->id,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'type' => $type,
            'status' => DataImportBatch::STATUS_PENDING,
            'meta' => $meta,
            'ip_address' => $request->ip(),
        ]);

        $desconocidas = $inspeccion['headers_unknown'] ?? [];
        if ($desconocidas !== []) {
            return back()->with('warning', 'Archivo cargado, pero estas columnas no existen en la plantilla y se ignoraran: '.implode(', ', $desconocidas).'.');
        }

        return back()->with('success', 'Archivo cargado. Pulsa «Procesar» para ejecutar la importacion.');
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
