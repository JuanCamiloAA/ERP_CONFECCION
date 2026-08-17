<?php

namespace App\Services\References;

use App\Models\Reference;
use App\Models\ReferenceOperation;
use App\Support\OperationDifficulty;
use Illuminate\Support\Facades\DB;

/**
 * Reaplica los rangos de "Dificultad por minutos" (Mi empresa > Tiempos y dificultades)
 * sobre las lineas ya guardadas de las referencias.
 *
 * El grado se guarda en la linea cuando se crea, asi que al mover los umbrales las lineas
 * viejas quedan con el grado anterior. Esto las pone al dia sin tener que borrarlas y
 * volverlas a asociar.
 *
 * Los umbrales se toman de la empresa de cada referencia, nunca de la sesion: asi un super
 * usuario viendo "Todas las empresas" no le aplica a un taller los rangos de otro.
 */
class ReferenceDifficultySync
{
    /**
     * Recalcula las lineas de una sola referencia.
     *
     * @return array{lines: int, changed: int, without_minutes: int}
     */
    public function forReference(Reference $reference): array
    {
        $reference->loadMissing('company');

        return $this->apply(
            ReferenceOperation::query()->where('reference_id', $reference->id),
            [$reference->id => OperationDifficulty::thresholdsFor($reference->company)]
        );
    }

    /**
     * Recalcula todas las referencias visibles. El scope de empresa de Reference es el que
     * decide el alcance, de modo que un usuario normal solo toca las de su taller.
     *
     * @return array{lines: int, changed: int, without_minutes: int, references: int}
     */
    public function forAllReferences(): array
    {
        $references = Reference::query()->with('company')->get(['id', 'company_id']);

        $thresholds = $references
            ->mapWithKeys(fn (Reference $r) => [$r->id => OperationDifficulty::thresholdsFor($r->company)])
            ->all();

        $result = $this->apply(
            ReferenceOperation::query()->whereIn('reference_id', $references->pluck('id')),
            $thresholds
        );

        return $result + ['references' => $references->count()];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<ReferenceOperation>  $query
     * @param  array<int, array<int, float>>  $thresholdsByReference  reference_id => umbrales
     * @return array{lines: int, changed: int, without_minutes: int}
     */
    private function apply($query, array $thresholdsByReference): array
    {
        $lines = 0;
        $changed = 0;
        $withoutMinutes = 0;

        DB::transaction(function () use ($query, $thresholdsByReference, &$lines, &$changed, &$withoutMinutes) {
            $query->with('operation:id,estimated_minutes')
                ->chunkById(200, function ($chunk) use ($thresholdsByReference, &$lines, &$changed, &$withoutMinutes) {
                    foreach ($chunk as $line) {
                        $lines++;

                        // Los minutos de la linea mandan; si no los tiene se usan los de la
                        // operacion, que es lo mismo que muestra la ficha de la referencia.
                        $minutes = $line->estimated_minutes ?? $line->operation?->estimated_minutes;

                        // Cero es "sin medir", no "muy facil": esas lineas se dejan sin grado.
                        if ($minutes === null || $minutes === '' || (float) $minutes <= 0) {
                            $withoutMinutes++;

                            continue;
                        }

                        $level = OperationDifficulty::levelFromMinutes(
                            (float) $minutes,
                            $thresholdsByReference[$line->reference_id] ?? OperationDifficulty::DEFAULT_THRESHOLDS
                        );

                        if ((int) $line->difficulty_level === $level) {
                            continue;
                        }

                        $line->update(['difficulty_level' => $level]);
                        $changed++;
                    }
                });
        });

        return ['lines' => $lines, 'changed' => $changed, 'without_minutes' => $withoutMinutes];
    }
}
