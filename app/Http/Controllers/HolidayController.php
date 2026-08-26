<?php

namespace App\Http\Controllers;

use App\Http\Requests\Holiday\StoreHolidayRequest;
use App\Models\Holiday;
use App\Services\HolidayService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HolidayController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Holiday::class, 'holiday', ['except' => ['sync']]);
    }

    public function index(Request $request, HolidayService $service): Response
    {
        $year = (int) $request->input('year', now()->year);
        // Se acota el año: la cuadricula pinta 12 meses y un valor absurdo solo produce
        // una pantalla vacia sin explicacion.
        $year = max(2000, min(2100, $year));

        $holidays = Holiday::query()
            ->where('country_code', 'CO')
            ->whereYear('date', $year)
            ->orderBy('date')
            ->get();

        $originalDates = $service->originalDatesFor($year);

        return Inertia::render('Holidays/Index', [
            'holidays' => $holidays->map(fn (Holiday $holiday) => [
                'id' => $holiday->id,
                'date' => $holiday->date->toDateString(),
                'name' => $holiday->name,
                // De que fecha se movio. Sin esto, «Trasladado: Sí» no dice nada util.
                'original_date' => $holiday->is_emiliani_shifted
                    ? ($originalDates[$holiday->date->toDateString()] ?? null)
                    : null,
                'is_emiliani_shifted' => (bool) $holiday->is_emiliani_shifted,
                'source' => $holiday->source,
            ])->values(),
            'filters' => ['year' => $year],
            // No hay tabla de sincronizaciones: la ultima escritura de un festivo
            // calculado del año es exactamente cuando se sincronizo.
            'lastSyncedAt' => $holidays
                ->where('source', Holiday::SOURCE_CALCULATED)
                ->max('updated_at')?->toIso8601String(),
        ]);
    }

    public function store(StoreHolidayRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['country_code'] = $data['country_code'] ?? 'CO';
        $data['source'] = Holiday::SOURCE_MANUAL;
        $data['is_emiliani_shifted'] = false;

        Holiday::create($data);

        return back()->with('success', 'Festivo agregado.');
    }

    public function destroy(Holiday $holiday): RedirectResponse
    {
        if ($holiday->source !== Holiday::SOURCE_MANUAL) {
            return back()->with('error', 'Solo se pueden eliminar festivos manuales; los calculados se regeneran con Sincronizar.');
        }

        $holiday->delete();

        return back()->with('success', 'Festivo eliminado.');
    }

    public function sync(Request $request, HolidayService $service): RedirectResponse
    {
        $this->authorize('sync', Holiday::class);

        $year = (int) $request->input('year', now()->year);
        $year = max(2000, min(2100, $year));
        $count = $service->syncYear($year);

        return back()->with('success', "Festivos {$year} sincronizados ({$count}).");
    }
}
