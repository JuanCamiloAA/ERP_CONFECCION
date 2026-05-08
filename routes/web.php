<?php

use App\Http\Controllers\AdvanceController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\OperationController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\PayrollPeriodicityController;
use App\Http\Controllers\ProductionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReferenceController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\SuperAdmin\DataImportController;
use App\Http\Controllers\WorkDaySessionController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
});

Route::middleware(['auth', 'force.password'])->group(function () {
    Route::get('/profile/change-password', [ProfileController::class, 'showChangePassword'])->name('profile.change-password.show');
    Route::post('/profile/change-password', [ProfileController::class, 'changePassword'])->name('profile.change-password');
});

Route::middleware(['auth', 'force.password', 'company'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard')
        ->middleware('permission:dashboard.index.view');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');

    // Empresas (super_admin)
    Route::middleware('permission:companies.index.view')->group(function () {
        Route::resource('companies', CompanyController::class);
        Route::post('/companies/set-active', [CompanyController::class, 'setActive'])->name('companies.set-active');
    });

    Route::middleware('permission:payroll_periodicities.index.view')->group(function () {
        Route::resource('payroll-periodicities', PayrollPeriodicityController::class)->except(['show']);
    });

    // Empleados
    Route::middleware('permission:employees.index.view')->group(function () {
        Route::resource('employees', EmployeeController::class);
        Route::post('/employees/{employee}/access', [EmployeeController::class, 'storeAccess'])->name('employees.access.store');
        Route::post('/employees/{employee}/access/toggle', [EmployeeController::class, 'toggleAccess'])->name('employees.access.toggle');
        Route::post('/employees/{employee}/access/role', [EmployeeController::class, 'changeRole'])->name('employees.access.role');
        Route::post('/employees/{employee}/access/reset-password', [EmployeeController::class, 'resetPassword'])->name('employees.access.reset-password');
        Route::post('/employees/{employee}/deactivate', [EmployeeController::class, 'deactivate'])
            ->name('employees.deactivate')
            ->middleware('permission:employees.index.edit');
    });

    // Bancos (catalogo empresa)
    Route::middleware('permission:banks.index.view')->group(function () {
        Route::resource('banks', BankController::class)->except(['show']);
    });

    // Referencias
    Route::middleware('permission:references.index.view')->group(function () {
        Route::resource('references', ReferenceController::class);
        Route::post('/references/{reference}/operations', [ReferenceController::class, 'attachOperation'])->name('references.operations.attach');
        Route::put('/references/{reference}/operations/{operation}', [ReferenceController::class, 'updateOperationPrice'])->name('references.operations.update');
        Route::delete('/references/{reference}/operations/{operation}', [ReferenceController::class, 'detachOperation'])->name('references.operations.detach');
    });

    // Operaciones
    Route::middleware('permission:operations.index.view')->group(function () {
        Route::resource('operations', OperationController::class)->except(['show']);
    });

    // Produccion
    Route::middleware('permission:productions.index.view')->group(function () {
        Route::get('/productions/report', [ProductionController::class, 'report'])->name('productions.report');
        Route::get('/work-day-sessions/today', [WorkDaySessionController::class, 'today'])->name('work-day-sessions.today');
        Route::post('/work-day-sessions/start', [WorkDaySessionController::class, 'start'])->name('work-day-sessions.start');
        Route::post('/work-day-sessions/{workDaySession}/close', [WorkDaySessionController::class, 'close'])->name('work-day-sessions.close');
        Route::resource('productions', ProductionController::class)->except(['show']);
    });

    // Nomina
    Route::middleware('permission:payrolls.index.view')->group(function () {
        Route::resource('payrolls', PayrollController::class)->except(['edit', 'update']);
        Route::post('/payrolls/{payroll}/calculate', [PayrollController::class, 'calculate'])->name('payrolls.calculate');
        Route::post('/payrolls/{payroll}/approve', [PayrollController::class, 'approve'])->name('payrolls.approve');
        Route::post('/payrolls/{payroll}/pay', [PayrollController::class, 'pay'])->name('payrolls.pay');
        Route::get('/payrolls/{payroll}/export', [PayrollController::class, 'export'])->name('payrolls.export');
    });

    // Anticipos
    Route::middleware('permission:advances.index.view')->group(function () {
        Route::resource('advances', AdvanceController::class)->except(['show', 'edit', 'update']);
    });

    // Reportes
    Route::get('/reports/production', [ReportController::class, 'production'])
        ->name('reports.production')
        ->middleware('permission:reports.production.view');
    Route::get('/reports/payroll', [ReportController::class, 'payroll'])
        ->name('reports.payroll')
        ->middleware('permission:reports.payroll.view');

    // Usuarios
    Route::middleware('permission:users.index.view')->group(function () {
        Route::resource('users', UserController::class);
        Route::put('/users/{user}/permission-overrides', [UserController::class, 'updatePermissionOverrides'])
            ->name('users.permission-overrides.update')
            ->can('managePermissionOverrides', 'user');
    });

    // Roles y Permisos
    Route::middleware('permission:roles.index.view')->group(function () {
        Route::get('/roles/permission-matrix', [RoleController::class, 'permissionMatrix'])->name('roles.permission-matrix');
        Route::resource('roles', RoleController::class);
    });

    // Mi empresa (solo datos de la compania del usuario; empresas globales = superadmin)
    Route::middleware('permission:settings.index.view')->get('/settings', [SettingController::class, 'index'])->name('settings.index');
    Route::middleware('permission:settings.index.edit')->put('/settings', [SettingController::class, 'update'])->name('settings.update');

    // Importacion masiva CSV (solo super_admin)
    Route::middleware('super.admin')->prefix('super-admin')->name('super-admin.')->group(function () {
        Route::get('data-imports', [DataImportController::class, 'index'])->name('data-imports.index');
        Route::get('data-imports/templates/zip', [DataImportController::class, 'downloadTemplatesZip'])->name('data-imports.templates.zip');
        Route::get('data-imports/templates/{type}', [DataImportController::class, 'downloadTemplate'])->whereIn('type', \App\Models\DataImportBatch::types())->name('data-imports.templates');
        Route::get('data-imports/{batch}/errors', [DataImportController::class, 'downloadErrors'])->name('data-imports.errors');
        Route::get('data-imports/{batch}', [DataImportController::class, 'show'])->name('data-imports.show');
        Route::post('data-imports', [DataImportController::class, 'store'])
            ->middleware('throttle:data-import-upload')
            ->name('data-imports.store');
    });
});

require __DIR__.'/auth.php';
