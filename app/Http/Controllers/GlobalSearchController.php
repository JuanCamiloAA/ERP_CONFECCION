<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Payroll;
use App\Models\Reference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Buscador global del navbar (⌘K).
 *
 * Devuelve solo lo que el usuario puede abrir: cada bloque se salta si le falta el permiso
 * de la pantalla correspondiente. Los modelos ya llevan `CompanyScope`, así que el aislado
 * por empresa no hace falta repetirlo aquí.
 */
class GlobalSearchController extends Controller
{
    /** Resultados por bloque. Suficientes para reconocer el que se busca sin llenar la lista. */
    protected const PER_GROUP = 5;

    public function __invoke(Request $request): JsonResponse
    {
        $term = trim((string) $request->input('q', ''));

        // Con una sola letra casi todo coincide y el resultado no ayuda a decidir.
        if (mb_strlen($term) < 2) {
            return response()->json(['groups' => []]);
        }

        $user = $request->user();
        $groups = [];

        if ($user->can('employees.index.view')) {
            $employees = Employee::query()
                ->where(function ($q) use ($term) {
                    $q->where('first_name', 'like', "%{$term}%")
                        ->orWhere('last_name', 'like', "%{$term}%")
                        ->orWhere('document_number', 'like', "%{$term}%");
                })
                ->orderBy('first_name')
                ->limit(self::PER_GROUP)
                ->get(['id', 'first_name', 'last_name', 'document_number', 'is_active']);

            if ($employees->isNotEmpty()) {
                $groups[] = [
                    'key' => 'employees',
                    'label' => 'Empleados',
                    'items' => $employees->map(fn (Employee $employee) => [
                        'id' => 'employee-'.$employee->id,
                        'title' => trim($employee->first_name.' '.$employee->last_name),
                        'subtitle' => $employee->document_number
                            .($employee->is_active ? '' : ' · inactivo'),
                        'url' => route('employees.show', $employee->id),
                    ])->all(),
                ];
            }
        }

        if ($user->can('references.index.view')) {
            $references = Reference::query()
                ->where(function ($q) use ($term) {
                    $q->where('name', 'like', "%{$term}%")
                        ->orWhere('code', 'like', "%{$term}%");
                })
                ->orderBy('code')
                ->limit(self::PER_GROUP)
                ->get(['id', 'code', 'name']);

            if ($references->isNotEmpty()) {
                $groups[] = [
                    'key' => 'references',
                    'label' => 'Referencias',
                    'items' => $references->map(fn (Reference $reference) => [
                        'id' => 'reference-'.$reference->id,
                        'title' => trim($reference->code.' · '.$reference->name),
                        'subtitle' => 'Referencia',
                        'url' => route('references.show', $reference->id),
                    ])->all(),
                ];
            }
        }

        if ($user->can('payrolls.index.view')) {
            $payrolls = Payroll::query()
                ->where('name', 'like', "%{$term}%")
                ->orderByDesc('period_start')
                ->limit(self::PER_GROUP)
                ->get(['id', 'name', 'period_start', 'period_end', 'status']);

            if ($payrolls->isNotEmpty()) {
                $groups[] = [
                    'key' => 'payrolls',
                    'label' => 'Nóminas',
                    'items' => $payrolls->map(fn (Payroll $payroll) => [
                        'id' => 'payroll-'.$payroll->id,
                        'title' => $payroll->name,
                        'subtitle' => $payroll->period_start?->format('Y-m-d').' → '
                            .$payroll->period_end?->format('Y-m-d'),
                        'url' => route('payrolls.show', $payroll->id),
                    ])->all(),
                ];
            }
        }

        return response()->json(['groups' => $groups]);
    }
}
