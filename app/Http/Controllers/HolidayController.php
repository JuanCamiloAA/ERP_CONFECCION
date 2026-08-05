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

    public function index(Request $request): Response
    {
        $year = (int) $request->input('year', now()->year);

        $holidays = Holiday::query()
            ->where('country_code', 'CO')
            ->whereYear('date', $year)
            ->orderBy('date')
            ->get();

        return Inertia::render('Holidays/Index', [
            'holidays' => $holidays,
            'filters' => ['year' => $year],
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
        $count = $service->syncYear($year);

        return back()->with('success', "Festivos {$year} sincronizados ({$count}).");
    }
}
