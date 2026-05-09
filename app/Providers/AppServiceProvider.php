<?php

namespace App\Providers;

use App\Contracts\ObjectStorageInterface;
use App\Models\Company;
use App\Models\DataImportBatch;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Operation;
use App\Models\Payroll;
use App\Models\PayrollConcept;
use App\Models\PayrollPeriodicity;
use App\Models\Production;
use App\Models\Reference;
use App\Models\Role;
use App\Models\User;
use App\Observers\EmployeeObserver;
use App\Observers\ProductionObserver;
use App\Observers\UserObserver;
use App\Policies\CompanyPolicy;
use App\Policies\EmployeePolicy;
use App\Policies\ExpenseCategoryPolicy;
use App\Policies\ExpensePolicy;
use App\Policies\OperationPolicy;
use App\Policies\PayrollConceptPolicy;
use App\Policies\PayrollPeriodicityPolicy;
use App\Policies\PayrollPolicy;
use App\Policies\ProductionPolicy;
use App\Policies\ReferencePolicy;
use App\Policies\RolePolicy;
use App\Policies\UserPolicy;
use App\Services\Files\FirebaseObjectStorage;
use App\Services\Files\FirebaseStorageService;
use App\Services\Files\LocalPublicObjectStorage;
use App\Services\Files\MediaUrlResolver;
use App\Services\Files\StoredFileDeleter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(FirebaseStorageService::class);

        $this->app->singleton(MediaUrlResolver::class, function ($app) {
            return new MediaUrlResolver($app->make(FirebaseStorageService::class));
        });

        $this->app->singleton(StoredFileDeleter::class, function ($app) {
            return new StoredFileDeleter($app->make(FirebaseStorageService::class));
        });

        $this->app->bind(ObjectStorageInterface::class, function ($app) {
            $driver = (string) config('filesystems.default_upload', 'local');

            return match ($driver) {
                'firebase' => $app->make(FirebaseObjectStorage::class),
                default => $app->make(LocalPublicObjectStorage::class),
            };
        });
    }

    public function boot(): void
    {
        Model::shouldBeStrict(false);

        Employee::observe(EmployeeObserver::class);
        Production::observe(ProductionObserver::class);
        User::observe(UserObserver::class);

        Gate::policy(Employee::class, EmployeePolicy::class);
        Gate::policy(Reference::class, ReferencePolicy::class);
        Gate::policy(Operation::class, OperationPolicy::class);
        Gate::policy(Production::class, ProductionPolicy::class);
        Gate::policy(Payroll::class, PayrollPolicy::class);
        Gate::policy(PayrollConcept::class, PayrollConceptPolicy::class);
        Gate::policy(PayrollPeriodicity::class, PayrollPeriodicityPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Role::class, RolePolicy::class);

        if (class_exists(CompanyPolicy::class)) {
            Gate::policy(Company::class, CompanyPolicy::class);
        }

        Gate::policy(DataImportBatch::class, DataImportBatchPolicy::class);
        Gate::policy(Expense::class, ExpensePolicy::class);
        Gate::policy(ExpenseCategory::class, ExpenseCategoryPolicy::class);

        RateLimiter::for('data-import-upload', function (Request $request) {
            return Limit::perMinute(10)->by((string) $request->user()?->id ?: $request->ip());
        });

        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }
    }
}
