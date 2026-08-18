<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\Landing\UpdateLandingBlockRequest;
use App\Models\LandingBlock;
use App\Models\LandingVersion;
use App\Services\Landing\LandingDataSources;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Administracion de la landing publica por bloques (super usuario).
 *
 * El borrador vive en landing_blocks.data y solo pasa a published_data al publicar,
 * dejando ademas una version restaurable.
 */
class LandingAdminController extends Controller
{
    /**
     * Peso maximo de una imagen del editor, en KB.
     *
     * Un fondo a pantalla completa pesa mucho mas que una foto dentro de una tarjeta,
     * asi que el limite es holgado; el tope duro sigue siendo upload_max_filesize de
     * php.ini, que aqui esta en 40M.
     */
    private const MAX_IMAGE_KB = 8192;

    /** Formatos que acepta el selector de archivos y la validacion. */
    private const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

    public function index(): Response
    {
        $blocks = LandingBlock::ordered()->get();
        $sources = app(LandingDataSources::class);

        return Inertia::render('SuperAdmin/Landing/Index', [
            'blocks' => $blocks->map(function (LandingBlock $b) use ($sources) {
                $row = [
                    'id' => $b->id,
                    'type' => $b->type,
                    'position' => $b->position,
                    'is_visible' => $b->is_visible,
                    'data' => $b->data,
                    'is_dirty' => $b->is_dirty,
                ];

                // La vista previa necesita las filas ya resueltas; el error se muestra
                // aqui para que el super usuario lo vea antes de publicar.
                if ($b->type === 'data') {
                    $resolved = $sources->resolve($b->data ?? []);
                    $row['rows'] = $resolved['rows'];
                    $row['error'] = $resolved['error'];
                }

                return $row;
            })->values()->all(),
            'catalog' => config('landing_blocks'),
            // Tamano, fondo y animacion: comunes a todos los tipos de bloque.
            'appearanceSchema' => config('landing_appearance'),
            'icons' => config('landing_icons'),
            'linkTargets' => $this->linkTargets(),
            'fieldOptions' => app(LandingDataSources::class)->editorOptions(),
            // El editor avisa del limite antes de subir, en vez de esperar el rechazo.
            'media' => ['max_kb' => self::MAX_IMAGE_KB, 'accept' => self::IMAGE_ACCEPT],
            'dirtyCount' => $blocks->filter(fn (LandingBlock $b) => $b->is_dirty)->count(),
            'lastPublished' => LandingVersion::query()
                ->with('publisher:id,name')
                ->latest('published_at')
                ->first()?->only(['id', 'published_at']),
        ]);
    }

    /** @return list<array{label: string, url: string}> */
    private function linkTargets(): array
    {
        return [
            ['label' => 'Registro de empresa', 'url' => '/register'],
            ['label' => 'Ingresar', 'url' => '/login'],
            ['label' => 'Sección: Hero', 'url' => '#hero'],
            ['label' => 'Sección: Flujo', 'url' => '#flow'],
            ['label' => 'Sección: Virtudes', 'url' => '#virtues'],
            ['label' => 'Sección: Para quién', 'url' => '#audience'],
            ['label' => 'Sección: Pasos', 'url' => '#steps_media'],
            ['label' => 'Sección: Cierre', 'url' => '#closing'],
        ];
    }

    public function store(Request $request): RedirectResponse
    {
        $type = $request->validate([
            'type' => ['required', 'string', 'in:'.implode(',', array_keys(config('landing_blocks')))],
        ])['type'];

        // Un tipo marcado como singleton no puede repetirse en la pagina.
        if (config("landing_blocks.$type.singleton") && LandingBlock::query()->where('type', $type)->exists()) {
            return back()->with('error', 'Ese bloque ya existe y solo puede haber uno.');
        }

        LandingBlock::query()->create([
            'type' => $type,
            'position' => (int) LandingBlock::query()->max('position') + 10,
            'is_visible' => true,
            'data' => $this->blankDataFor($type),
        ]);

        return back()->with('success', 'Bloque añadido.');
    }

    public function update(UpdateLandingBlockRequest $request, LandingBlock $block): RedirectResponse
    {
        $block->update([
            'data' => $request->validated()['data'],
            'is_visible' => $request->boolean('is_visible', $block->is_visible),
        ]);

        return back(303);
    }

    public function duplicate(LandingBlock $block): RedirectResponse
    {
        if (config("landing_blocks.$block->type.singleton")) {
            return back()->with('error', 'Este bloque no se puede duplicar.');
        }

        LandingBlock::query()->create([
            'type' => $block->type,
            'position' => $block->position + 5,
            'is_visible' => $block->is_visible,
            'data' => $block->data,
        ]);

        $this->normalizePositions();

        return back()->with('success', 'Bloque duplicado.');
    }

    public function destroy(LandingBlock $block): RedirectResponse
    {
        $block->delete();
        $this->normalizePositions();

        return back()->with('success', 'Bloque eliminado.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer'],
        ])['ids'];

        DB::transaction(function () use ($ids) {
            foreach (array_values($ids) as $index => $id) {
                LandingBlock::query()->whereKey($id)->update(['position' => ($index + 1) * 10]);
            }
        });

        return back(303);
    }

    public function publish(Request $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $blocks = LandingBlock::ordered()->get();

            foreach ($blocks as $block) {
                $block->update(['published_data' => $block->data]);
            }

            LandingVersion::query()->create([
                'snapshot' => $blocks->map(fn (LandingBlock $b) => [
                    'id' => $b->id,
                    'type' => $b->type,
                    'position' => $b->position,
                    'is_visible' => $b->is_visible,
                    'data' => $b->data,
                ])->values()->all(),
                'published_by' => $request->user()?->id,
                'published_at' => now(),
            ]);
        });

        return back()->with('success', 'Landing publicada.');
    }

    public function versions(): JsonResponse
    {
        $versions = LandingVersion::query()
            ->with('publisher:id,name')
            ->latest('published_at')
            ->limit(30)
            ->get()
            ->map(fn (LandingVersion $v) => [
                'id' => $v->id,
                'published_at' => $v->published_at?->toIso8601String(),
                'published_by' => $v->publisher?->name,
                'blocks' => is_array($v->snapshot) ? count($v->snapshot) : 0,
            ]);

        return response()->json(['versions' => $versions]);
    }

    /** Restaurar repone el borrador; el usuario decide despues si publica. */
    public function restore(LandingVersion $version): RedirectResponse
    {
        DB::transaction(function () use ($version) {
            foreach ((array) $version->snapshot as $entry) {
                if (! is_array($entry) || ! isset($entry['type'])) {
                    continue;
                }

                // Empareja por id; los snapshots viejos no lo traen y caen al tipo, que
                // era unico cuando se tomaron.
                $query = isset($entry['id'])
                    ? LandingBlock::query()->whereKey($entry['id'])
                    : LandingBlock::query()->where('type', $entry['type']);

                $query->update([
                    'data' => $entry['data'] ?? [],
                    'position' => $entry['position'] ?? 0,
                    'is_visible' => (bool) ($entry['is_visible'] ?? true),
                ]);
            }
        });

        return back()->with('success', 'Versión restaurada en el borrador. Publica para que salga al aire.');
    }

    public function media(Request $request): JsonResponse
    {
        // Los mensajes se escriben aqui porque el editor los muestra tal cual: quien
        // sube una imagen tiene que saber si fallo por peso, por formato o por sesion.
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,avif,gif', 'max:'.self::MAX_IMAGE_KB],
        ], [
            'image.required' => 'No llego ningun archivo.',
            'image.image' => 'El archivo no es una imagen.',
            'image.mimes' => 'Formato no admitido: usa jpg, png, webp, avif o gif.',
            'image.max' => 'La imagen supera los '.(int) (self::MAX_IMAGE_KB / 1024).' MB.',
        ]);

        $path = $request->file('image')->store('landing', 'public');

        return response()->json(['path' => $path, 'url' => asset('storage/'.$path)]);
    }

    /**
     * Contenido inicial de un bloque: las claves de su esquema en blanco.
     *
     * Importa que sea un objeto y no una lista vacia: `[]` viaja a JavaScript como arreglo,
     * y ahi las claves de texto que escriba el editor se pierden al serializar de vuelta.
     *
     * @return array<string, mixed>
     */
    private function blankDataFor(string $type): array
    {
        $fields = config("landing_blocks.$type.fields", []);
        $blank = [];

        foreach ($fields as $key => $field) {
            $blank[$key] = match ($field['type'] ?? 'text') {
                'repeater', 'multiselect' => [],
                'link' => ['label' => '', 'url' => ''],
                default => '',
            };
        }

        return $blank;
    }

    private function normalizePositions(): void
    {
        LandingBlock::ordered()->get()->each(function (LandingBlock $b, int $i) {
            $b->update(['position' => ($i + 1) * 10]);
        });
    }
}
