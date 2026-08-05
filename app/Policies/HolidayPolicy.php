<?php

namespace App\Policies;

use App\Models\Holiday;
use App\Models\User;

/**
 * Los festivos son informacion nacional compartida (sin company_id que proteger, §4.6): cualquier
 * admin de empresa o super_admin con el permiso puede sincronizar/agregar/eliminar festivos.
 */
class HolidayPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('holidays.index.view');
    }

    public function view(User $user, Holiday $holiday): bool
    {
        return $user->can('holidays.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('holidays.index.create');
    }

    public function delete(User $user, Holiday $holiday): bool
    {
        if ($holiday->source !== Holiday::SOURCE_MANUAL) {
            return false; // los calculados solo se regeneran con el comando, no se eliminan a mano
        }

        return $user->can('holidays.index.delete');
    }

    public function sync(User $user): bool
    {
        return $user->can('holidays.index.sync');
    }
}
