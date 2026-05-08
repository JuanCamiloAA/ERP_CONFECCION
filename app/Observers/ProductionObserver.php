<?php

namespace App\Observers;

use App\Models\Production;
use App\Support\ReferenceLotCompletion;

class ProductionObserver
{
    public function saved(Production $production): void
    {
        $ids = [(int) $production->reference_id];

        if ($production->wasChanged('reference_id')) {
            $original = $production->getOriginal('reference_id');
            if ($original !== null && $original !== '') {
                $ids[] = (int) $original;
            }
        }

        foreach (array_unique(array_filter($ids)) as $referenceId) {
            ReferenceLotCompletion::sync($referenceId);
        }
    }

    public function deleted(Production $production): void
    {
        if ($production->reference_id) {
            ReferenceLotCompletion::sync((int) $production->reference_id);
        }
    }

    public function restored(Production $production): void
    {
        if ($production->reference_id) {
            ReferenceLotCompletion::sync((int) $production->reference_id);
        }
    }
}
