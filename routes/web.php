<?php

use App\Http\Controllers\AdvanceController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DashboardLayoutController;
use App\Http\Controllers\DashboardWidgetDataController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\HolidayController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\LandingPlanInquiryController;
use App\Http\Controllers\OperationController;
use App\Http\Controllers\PayrollConceptController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\PayrollEmployeeAdjustmentController;
use App\Http\Controllers\PayrollLegalParameterController;
use App\Http\Controllers\PayrollPeriodicityController;
use App\Http\Controllers\ProductionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReferenceController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SuperAdmin\ActiveCompanyController;
use App\Http\Controllers\SuperAdmin\DashboardWidgetController;
use App\Http\Controllers\SuperAdmin\DataImportController;
use App\Http\Controllers\SuperAdmin\DataImportPresetController;
use App\Http\Controllers\SuperAdmin\LandingAdminController;
use App\Http\Controllers\SuperAdmin\LandingCmsController;
use App\Http\Controllers\SuperAdmin\MembershipPlanController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkDaySessionController;
use App\Models\DataImportBatch;
use Illuminate\Support\Facades\Route;

Route::get('/', [LandingController::class, 'show'])->name('landing');
Route::post('/landing/plan-inquiry', LandingPlanInquiryController::class)
    ->name('landing.plan-inquiry')
    ->middleware('throttle:10,1');

Route::middleware(['auth', 'force.password', 'company'])->group(function () {
    Route::get('/profile/change-password', [ProfileController::class, 'showChangePassword'])->name('profile.change-password.show');
    Route::post('/profile/change-password', [ProfileController::class, 'changePassword'])->name('profile.change-password');
});

Route::middleware(['auth', 'force.password', 'company'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard')
        ->middleware('permission:dashboard.index.view');

    Route::get('/dashboard/widgets/{widget}/data', [DashboardWidgetDataController::class, 'show'])
        ->name('dashboard.widgets.data')
        ->middleware('permission:dashboard.index.view');

    Route::put('/dashboard/layout', [DashboardLayoutController::class, 'update'])
        ->name('dashboard.layout.update')
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
        Route::post('/employees/{employee}/reactivate', [EmployeeController::class, 'reactivate'])
            ->name('employees.reactivate')
            ->middleware('permission:employees.index.edit');
    });

    // Bancos (catalogo empresa)
    Route::middleware('permission:banks.index.view')->group(function () {
        Route::resource('banks', BankController::class)->except(['show']);
    });

    // Referencias
    Route::middleware('permission:references.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {reference}.
        Route::post('/references/recalculate-difficulty', [ReferenceController::class, 'recalculateAllDifficulties'])->name('references.recalculate-difficulty');
        Route::get('/references/export/excel', [ReferenceController::class, 'exportExcel'])->name('references.export.excel');
        Route::get('/references/export/pdf', [ReferenceController::class, 'exportPdf'])->name('references.export.pdf');
        Route::resource('references', ReferenceController::class);
        Route::post('/references/{reference}/duplicate', [ReferenceController::class, 'duplicate'])->name('references.duplicate');
        Route::post('/references/{reference}/recalculate-difficulty', [ReferenceController::class, 'recalculateDifficulties'])->name('references.operations.recalculate');
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

    Route::middleware('permission:productions.ranking.view')->group(function () {
        Route::get('/productions/ranking', [ProductionController::class, 'ranking'])->name('productions.ranking');
    });

    // Nomina
    Route::middleware('permission:payrolls.index.view')->group(function () {
        Route::resource('payrolls', PayrollController::class)->except(['edit', 'update']);
        Route::post('/payrolls/{payroll}/calculate', [PayrollController::class, 'calculate'])->name('payrolls.calculate');
        Route::post('/payrolls/{payroll}/approve', [PayrollController::class, 'approve'])->name('payrolls.approve');
        Route::post('/payrolls/{payroll}/pay', [PayrollController::class, 'pay'])->name('payrolls.pay');
        Route::get('/payrolls/{payroll}/export', [PayrollController::class, 'export'])->name('payrolls.export');
    });

    Route::middleware('permission:payrolls.show.manage_adjustments')->group(function () {
        Route::post('/payrolls/{payroll}/payroll-employees/{payrollEmployee}/adjustments', [PayrollEmployeeAdjustmentController::class, 'store'])
            ->name('payrolls.payroll-employees.adjustments.store');
        Route::put('/payrolls/{payroll}/payroll-employees/{payrollEmployee}/adjustments/{adjustment}', [PayrollEmployeeAdjustmentController::class, 'update'])
            ->name('payrolls.payroll-employees.adjustments.update');
        Route::delete('/payrolls/{payroll}/payroll-employees/{payrollEmployee}/adjustments/{adjustment}', [PayrollEmployeeAdjustmentController::class, 'destroy'])
            ->name('payrolls.payroll-employees.adjustments.destroy');
    });

    Route::middleware('permission:payroll_concepts.index.view')->group(function () {
        Route::resource('payroll-concepts', PayrollConceptController::class)->except(['show']);
    });

    Route::middleware('permission:payroll_legal_parameters.index.view')->group(function () {
        Route::resource('payroll-legal-parameters', PayrollLegalParameterController::class)->except(['show']);
    });

    Route::middleware('permission:holidays.index.view')->group(function () {
        Route::post('/holidays/sync', [HolidayController::class, 'sync'])->name('holidays.sync');
        Route::resource('holidays', HolidayController::class)->only(['index', 'store', 'destroy']);
    });

    // Anticipos
    Route::middleware('permission:advances.index.view')->group(function () {
        Route::resource('advances', AdvanceController::class)->except(['show', 'edit', 'update']);
    });

    // Gastos (solo usuarios de empresa; policies bloquean super_admin)
    Route::middleware('permission:expenses.categories.view')->group(function () {
        Route::resource('expense-categories', ExpenseCategoryController::class)->except(['show']);
    });

    Route::middleware('permission:expenses.index.view')->group(function () {
        Route::resource('expenses', ExpenseController::class);
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
        Route::post('active-company', [ActiveCompanyController::class, 'store'])
            ->middleware('throttle:60,1')
            ->name('active-company');
        Route::get('data-imports', [DataImportController::class, 'index'])->name('data-imports.index');
        Route::get('data-imports/templates/zip', [DataImportController::class, 'downloadTemplatesZip'])->name('data-imports.templates.zip');
        Route::get('data-imports/templates/{type}', [DataImportController::class, 'downloadTemplate'])->whereIn('type', DataImportBatch::types())->name('data-imports.templates');
        Route::get('data-imports/{batch}/errors', [DataImportController::class, 'downloadErrors'])->name('data-imports.errors');
        // Debe ir antes de {batch}: si no, 'errors.csv' se tomaria como el id del lote.
        Route::get('data-imports/{batch}/errors-csv', [DataImportController::class, 'downloadErrorRows'])->name('data-imports.errors.csv');
        Route::get('data-imports/{batch}/preview', [DataImportController::class, 'preview'])->name('data-imports.preview');
        Route::get('data-imports/{batch}/file', [DataImportController::class, 'downloadFile'])->name('data-imports.file');
        Route::post('data-imports/{batch}/process', [DataImportController::class, 'process'])->name('data-imports.process');
        Route::delete('data-imports/{batch}', [DataImportController::class, 'destroy'])->name('data-imports.destroy');
        Route::get('data-imports/{batch}', [DataImportController::class, 'show'])->name('data-imports.show');
        Route::post('data-imports', [DataImportController::class, 'store'])
            ->name('data-imports.store');

        // Selecciones de campos guardadas para las plantillas.
        Route::post('data-import-presets', [DataImportPresetController::class, 'store'])->name('data-import-presets.store');
        Route::delete('data-import-presets/{preset}', [DataImportPresetController::class, 'destroy'])->name('data-import-presets.destroy');

        // CMS anterior: secciones heredadas (planes, clientes) y ajustes globales / SEO.
        Route::get('landing-legacy', [LandingCmsController::class, 'index'])->name('landing-legacy.index');
        // Debe ir ANTES de sections/{landingSection}: si no, el parametro capturaria "reorder".
        // Editor de la landing por bloques (modelo landing_blocks).
        // 'reorder' va antes que '{block}' para que el parametro no lo capture.
        Route::get('landing', [LandingAdminController::class, 'index'])->name('landing.index');
        Route::post('landing/blocks', [LandingAdminController::class, 'store'])->name('landing.blocks.store');
        Route::put('landing/blocks/reorder', [LandingAdminController::class, 'reorder'])->name('landing.blocks.reorder');
        Route::put('landing/blocks/{block}', [LandingAdminController::class, 'update'])->name('landing.blocks.update');
        Route::post('landing/blocks/{block}/duplicate', [LandingAdminController::class, 'duplicate'])->name('landing.blocks.duplicate');
        Route::delete('landing/blocks/{block}', [LandingAdminController::class, 'destroy'])->name('landing.blocks.destroy');
        Route::post('landing/publish-blocks', [LandingAdminController::class, 'publish'])->name('landing.publish-blocks');
        Route::get('landing/versions', [LandingAdminController::class, 'versions'])->name('landing.versions');
        Route::post('landing/versions/{version}/restore', [LandingAdminController::class, 'restore'])->name('landing.versions.restore');
        Route::post('landing/block-media', [LandingAdminController::class, 'media'])->name('landing.block-media');
        Route::put('landing/sections/reorder', [LandingCmsController::class, 'reorderSections'])->name('landing.sections.reorder');
        Route::put('landing/sections/{landingSection}', [LandingCmsController::class, 'updateSection'])->name('landing.sections.update');
        Route::post('landing/sections/{landingSection}/publish', [LandingCmsController::class, 'publishSection'])->name('landing.sections.publish');
        Route::post('landing/sections/{landingSection}/discard', [LandingCmsController::class, 'discardDraft'])->name('landing.sections.discard');
        Route::post('landing/sections/{landingSection}/reset', [LandingCmsController::class, 'resetSection'])->name('landing.sections.reset');
        Route::post('landing/sections', [LandingCmsController::class, 'storeCustomSection'])->name('landing.sections.store');
        Route::delete('landing/sections/{landingSection}', [LandingCmsController::class, 'destroySection'])->name('landing.sections.destroy');
        Route::post('landing/publish-all', [LandingCmsController::class, 'publishAll'])->name('landing.publish-all');
        Route::post('landing/media', [LandingCmsController::class, 'storeMedia'])->name('landing.media');
        Route::put('landing/globals', [LandingCmsController::class, 'updateGlobals'])->name('landing.globals');

        Route::resource('membership-plans', MembershipPlanController::class)->except(['show']);

        Route::post('dashboard-widgets/preview', [DashboardWidgetController::class, 'preview'])->name('dashboard-widgets.preview');
        Route::put('dashboard-widgets/{dashboard_widget}/visibility', [DashboardWidgetController::class, 'updateVisibility'])->name('dashboard-widgets.visibility');
        Route::resource('dashboard-widgets', DashboardWidgetController::class)->except(['show']);
    });
});

require __DIR__.'/auth.php';
