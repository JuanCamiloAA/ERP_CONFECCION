<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\DataImportBatch;
use App\Models\DataImportFieldPreset;
use App\Services\DataImport\ImportFieldCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Selecciones de campos guardadas para las plantillas de importacion.
 *
 * Guardar y borrar; no hay edicion, porque guardar con el mismo nombre ya sobrescribe.
 */
class DataImportPresetController extends Controller
{
    public function __construct(private readonly ImportFieldCatalog $catalog) {}

    public function store(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'type' => ['required', 'string', Rule::in(DataImportBatch::types())],
            'name' => ['required', 'string', 'max:60'],
            'fields' => ['required', 'array', 'min:1'],
            'fields.*' => ['string', 'max:64'],
            'is_shared' => ['nullable', 'boolean'],
        ], [
            'name.required' => 'Ponle un nombre al preset.',
            'fields.required' => 'Elige al menos un campo antes de guardar.',
        ]);

        // Las claves que no existan en el catalogo se descartan en vez de tumbar el
        // guardado: la plantilla la manda la tabla, no lo que llegue del navegador.
        $validas = array_map(fn (array $campo) => $campo['key'], $this->catalog->fields($datos['type']));
        $campos = array_values(array_intersect($datos['fields'], $validas));

        if ($campos === []) {
            return back()->with('error', 'Ninguno de esos campos existe en la plantilla.');
        }

        DataImportFieldPreset::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'type' => $datos['type'],
                'name' => trim($datos['name']),
            ],
            [
                'fields' => $campos,
                'is_shared' => (bool) ($datos['is_shared'] ?? false),
            ],
        );

        return back()->with('success', 'Preset guardado.');
    }

    public function destroy(Request $request, DataImportFieldPreset $preset): RedirectResponse
    {
        // Un preset compartido lo ve todo el mundo, pero solo lo borra quien lo creo.
        if ((int) $preset->user_id !== (int) $request->user()->id) {
            return back()->with('error', 'Ese preset es de otro usuario.');
        }

        $preset->delete();

        return back()->with('success', 'Preset eliminado.');
    }
}
