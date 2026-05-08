<?php

namespace App\Observers;

use App\Models\AccessLog;
use App\Models\User;

class UserObserver
{
    public function updated(User $user): void
    {
        if ($user->wasChanged('last_login_at') && $user->last_login_at) {
            AccessLog::log('login', $user->id);
        }
    }
}
