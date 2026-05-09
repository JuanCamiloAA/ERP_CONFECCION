<?php

namespace App\Models\Scopes;

use App\Models\User;
use App\Support\TenantContext;
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

        /** @var User $user */
        $user = auth()->user();

        if ($user->isSuperAdmin()) {
            TenantContext::migrateLegacySession();
            $selected = TenantContext::superAdminSelectedCompanyId();
            if ($selected === null) {
                return;
            }
            $builder->where($model->getTable().'.company_id', $selected);

            return;
        }

        $companyId = $user->company_id;

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
