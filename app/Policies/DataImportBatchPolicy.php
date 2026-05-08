<?php

namespace App\Policies;

use App\Models\DataImportBatch;
use App\Models\User;

class DataImportBatchPolicy
{
    public function before(User $user): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, DataImportBatch $batch): bool
    {
        return false;
    }
}
