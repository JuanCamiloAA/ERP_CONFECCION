<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayrollPeriodicity\StorePayrollPeriodicityRequest;
use App\Http\Requests\PayrollPeriodicity\UpdatePayrollPeriodicityRequest;
use App\Models\Payroll;
use App\Models\PayrollPeriodicity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PayrollPeriodicityController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', PayrollPeriodicity::class);

        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', 'all');

        $query = PayrollPeriodicity::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $rows = $query->withCount([
            'payrolls' => fn ($q) => $q->withoutGlobalScopes(),
        ])->ordered()->paginate(20)->withQueryString();

        // Se usa como periodicidad por defecto de una empresa: desactivarla romperia el
        // selector de «Mi empresa», asi que la pantalla lo avisa antes.
        $companyUsage = DB::table('companies')
            ->whereNull('deleted_at')
            ->pluck('settings')
            ->map(fn ($json) => is_string($json) ? (json_decode($json, true)['payroll_periodicity'] ?? null) : null)
            ->filter()
            ->countBy()
            ->all();

        $rows->getCollection()->transform(function (PayrollPeriodicity $row) use ($companyUsage) {
            $row->setAttribute('companies_count', (int) ($companyUsage[$row->code] ?? 0));

            return $row;
        });

        return Inertia::render('PayrollPeriodicities/Index', [
            'periodicities' => $rows,
            'filters' => ['search' => $search, 'status' => $status],
            'chipCounts' => [
                'all' => PayrollPeriodicity::query()->count(),
                'active' => PayrollPeriodicity::query()->where('is_active', true)->count(),
                'inactive' => PayrollPeriodicity::query()->where('is_active', false)->count(),
            ],
        ]);
    }

    /**
     * Reescribe el orden de la lista.
     *
     * El orden manda en los selectores de nomina y en «Mi empresa», asi que se guarda entero
     * en una transaccion: a medio aplicar dejaria dos periodicidades con el mismo numero y un
     * orden distinto en cada pantalla.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $this->authorize('reorder', PayrollPeriodicity::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:payroll_periodicities,id'],
        ]);

        DB::transaction(function () use ($validated) {
            $ids = array_values(array_unique(array_map('intval', $validated['ids'])));

            // Se permutan las posiciones que ya ocupaban esas filas, no se numeran de 1 a N:
            // la lista esta paginada y filtrada, y renumerar desde 1 le daria a la pagina 2
            // los mismos `sort_order` que a la 1.
            $slots = PayrollPeriodicity::query()
                ->whereIn('id', $ids)
                ->ordered()
                ->pluck('sort_order')
                ->all();

            // Dos filas con el mismo `sort_order` harian que mover una no cambiara nada,
            // porque el desempate del listado es el nombre. Se separan al vuelo.
            for ($i = 1; $i < count($slots); $i++) {
                if ($slots[$i] <= $slots[$i - 1]) {
                    $slots[$i] = $slots[$i - 1] + 1;
                }
            }

            foreach ($ids as $position => $id) {
                if (! array_key_exists($position, $slots)) {
                    continue;
                }

                PayrollPeriodicity::query()->whereKey($id)->update(['sort_order' => $slots[$position]]);
            }
        });

        return back()->with('success', 'Orden actualizado.');
    }

    /**
     * Activa o desactiva desde el listado.
     *
     * Endpoint propio y no `update`: aquel exige `name` y sobrescribiria la fila entera con
     * lo que tuviera la pantalla en memoria, pisando ediciones hechas en otra pestana.
     */
    public function toggle(Request $request, PayrollPeriodicity $payrollPeriodicity): RedirectResponse
    {
        $this->authorize('toggle', $payrollPeriodicity);

        $active = $request->validate([
            'is_active' => ['required', 'boolean'],
        ])['is_active'];

        // Desactivar no se bloquea (`update` tampoco lo hace, y «Mi empresa» ya cae a la
        // periodicidad por defecto cuando la suya deja de estar activa), pero si se dice a
        // cuantas empresas afecta: es lo que no se ve desde el listado.
        $usedBy = $active ? 0 : DB::table('companies')
            ->whereNull('deleted_at')
            ->pluck('settings')
            ->filter(fn ($json) => is_string($json)
                && (json_decode($json, true)['payroll_periodicity'] ?? null) === $payrollPeriodicity->code)
            ->count();

        $payrollPeriodicity->update(['is_active' => $active]);

        if ($active) {
            return back()->with('success', 'Periodicidad activada.');
        }

        return back()->with('success', $usedBy === 0
            ? 'Periodicidad desactivada.'
            : ($usedBy === 1
                ? 'Periodicidad desactivada. 1 empresa la tenia por defecto y pasara a la periodicidad predeterminada.'
                : "Periodicidad desactivada. {$usedBy} empresas la tenian por defecto y pasaran a la periodicidad predeterminada."));
    }

    public function create(): Response
    {
        $this->authorize('create', PayrollPeriodicity::class);

        return Inertia::render('PayrollPeriodicities/Create');
    }

    public function store(StorePayrollPeriodicityRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', true);
        // Al final de la lista y no en 0: el formulario ya no pide el orden (se cambia
        // arrastrando en el listado) y un 0 colaria cada alta nueva en la primera posicion.
        $data['sort_order'] = $data['sort_order']
            ?? ((int) PayrollPeriodicity::query()->max('sort_order') + 1);
        PayrollPeriodicity::create($data);

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad creada.');
    }

    public function edit(PayrollPeriodicity $payrollPeriodicity): Response
    {
        $this->authorize('update', $payrollPeriodicity);

        $payrollPeriodicity->loadCount([
            'payrolls' => fn ($q) => $q->withoutGlobalScopes(),
        ]);

        // Cuantas empresas la tienen por defecto: es el dato que decide si desactivarla
        // rompe algo, y sin el la pantalla pediria confirmar a ciegas.
        $companiesCount = DB::table('companies')
            ->whereNull('deleted_at')
            ->pluck('settings')
            ->filter(fn ($json) => is_string($json)
                && (json_decode($json, true)['payroll_periodicity'] ?? null) === $payrollPeriodicity->code)
            ->count();

        return Inertia::render('PayrollPeriodicities/Edit', [
            'periodicity' => $payrollPeriodicity,
            'companiesCount' => $companiesCount,
        ]);
    }

    public function update(UpdatePayrollPeriodicityRequest $request, PayrollPeriodicity $payrollPeriodicity): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active', $payrollPeriodicity->is_active);
        $payrollPeriodicity->update($data);

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad actualizada.');
    }

    public function destroy(PayrollPeriodicity $payrollPeriodicity): RedirectResponse
    {
        $this->authorize('delete', $payrollPeriodicity);

        $inUse = Payroll::query()
            ->withoutGlobalScopes()
            ->where('type', $payrollPeriodicity->code)
            ->exists();

        if ($inUse) {
            if ($payrollPeriodicity->is_active) {
                $payrollPeriodicity->update(['is_active' => false]);

                return back()->with('success', 'La periodicidad esta en uso; se desactivo en lugar de eliminar.');
            }

            return back()->with('error', 'No se puede eliminar: hay nominas con esta periodicidad.');
        }

        $payrollPeriodicity->delete();

        return redirect()->route('payroll-periodicities.index')->with('success', 'Periodicidad eliminada.');
    }
}
