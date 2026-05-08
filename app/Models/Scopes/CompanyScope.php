<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! auth()->check()) {
            return;
        }

        /** @var \App\Models\User $user */
        $user = auth()->user();

        if ($user->isSuperAdmin()) {
            return;
        }

        $companyId = $user->company_id ?? session('active_company_id');

        if ($companyId) {
            $builder->where($model->getTable().'.company_id', $companyId);
        }
    }

    public function extend(Builder $builder): void
    {
        $builder->macro('withoutCompanyScope', function (Builder $b) {
            return $b->withoutGlobalScope(self::class);
        });

        $builder->macro('forCompany', function (Builder $b, int $companyId) {
            return $b->withoutGlobalScope(self::class)
                ->where($b->getModel()->getTable().'.company_id', $companyId);
        });
    }
}
