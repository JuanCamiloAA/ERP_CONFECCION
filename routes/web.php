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
        ->middleware('permission:dashboard.index.customize');

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
        Route::resource('employees', EmployeeController::class)
            ->middlewareFor(['create', 'store'], 'permission:employees.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:employees.index.edit')
            ->middlewareFor('destroy', 'permission:employees.index.delete')
            ->middlewareFor('show', 'permission:employees.show.view');
        Route::post('/employees/{employee}/access', [EmployeeController::class, 'storeAccess'])
            ->name('employees.access.store')
            ->middleware('permission:employees.access.create');
        Route::post('/employees/{employee}/access/toggle', [EmployeeController::class, 'toggleAccess'])
            ->name('employees.access.toggle')
            ->middleware('permission:employees.access.toggle');
        Route::post('/employees/{employee}/access/role', [EmployeeController::class, 'changeRole'])
            ->name('employees.access.role')
            ->middleware('permission:employees.access.change_role');
        Route::post('/employees/{employee}/access/reset-password', [EmployeeController::class, 'resetPassword'])
            ->name('employees.access.reset-password')
            ->middleware('permission:employees.access.reset_password');
        Route::post('/employees/{employee}/deactivate', [EmployeeController::class, 'deactivate'])
            ->name('employees.deactivate')
            ->middleware('permission:employees.index.deactivate');
        Route::post('/employees/{employee}/reactivate', [EmployeeController::class, 'reactivate'])
            ->name('employees.reactivate')
            ->middleware('permission:employees.index.reactivate');
    });

    // Bancos (catalogo empresa)
    Route::middleware('permission:banks.index.view')->group(function () {
        Route::resource('banks', BankController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:banks.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:banks.index.edit')
            ->middlewareFor('destroy', 'permission:banks.index.delete');
    });

    // Referencias
    Route::middleware('permission:references.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {reference}.
        Route::post('/references/recalculate-difficulty', [ReferenceController::class, 'recalculateAllDifficulties'])
            ->name('references.recalculate-difficulty')
            ->middleware('permission:references.index.recalculate_difficulty');
        Route::get('/references/export/excel', [ReferenceController::class, 'exportExcel'])
            ->name('references.export.excel')
            ->middleware('permission:references.index.export_excel');
        Route::get('/references/export/pdf', [ReferenceController::class, 'exportPdf'])
            ->name('references.export.pdf')
            ->middleware('permission:references.index.export_pdf');
        Route::resource('references', ReferenceController::class)
            ->middlewareFor(['create', 'store'], 'permission:references.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:references.index.edit')
            ->middlewareFor('destroy', 'permission:references.index.delete')
            ->middlewareFor('show', 'permission:references.show.view');
        Route::post('/references/{reference}/duplicate', [ReferenceController::class, 'duplicate'])
            ->name('references.duplicate')
            ->middleware('permission:references.index.duplicate');
        Route::post('/references/{reference}/recalculate-difficulty', [ReferenceController::class, 'recalculateDifficulties'])
            ->name('references.operations.recalculate')
            ->middleware('permission:references.operations.recalculate');
        Route::post('/references/{reference}/operations', [ReferenceController::class, 'attachOperation'])
            ->name('references.operations.attach')
            ->middleware('permission:references.operations.attach');
        Route::put('/references/{reference}/operations/{operation}', [ReferenceController::class, 'updateOperationPrice'])
            ->name('references.operations.update')
            ->middleware('permission:references.operations.update');
        Route::delete('/references/{reference}/operations/{operation}', [ReferenceController::class, 'detachOperation'])
            ->name('references.operations.detach')
            ->middleware('permission:references.operations.detach');
    });

    // Operaciones
    Route::middleware('permission:operations.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {operation}.
        Route::post('/operations/bulk-status', [OperationController::class, 'bulkStatus'])
            ->name('operations.bulk-status')
            ->middleware('permission:operations.index.bulk_status');
        Route::resource('operations', OperationController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:operations.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:operations.index.edit')
            ->middlewareFor('destroy', 'permission:operations.index.delete');
        Route::get('/operations/{operation}', [OperationController::class, 'show'])
            ->name('operations.show')
            ->middleware('permission:operations.show.view');
        Route::patch('/operations/{operation}/price', [OperationController::class, 'updatePrice'])
            ->name('operations.price')
            ->middleware('permission:operations.index.edit_price');
        Route::post('/operations/{operation}/duplicate', [OperationController::class, 'duplicate'])
            ->name('operations.duplicate')
            ->middleware('permission:operations.index.duplicate');
    });

    // Produccion
    Route::middleware('permission:productions.index.view')->group(function () {
        Route::get('/productions/report', [ProductionController::class, 'report'])
            ->name('productions.report')
            ->middleware('permission:productions.report.view');
        // Antes del resource: un segmento literal no puede quedar detras de {production}.
        Route::get('/productions/export', [ProductionController::class, 'export'])
            ->name('productions.export')
            ->middleware('permission:productions.index.export');
        Route::post('/productions/confirm-day', [ProductionController::class, 'confirmDay'])
            ->name('productions.confirm-day')
            ->middleware('permission:productions.index.confirm_day');
        Route::post('/productions/{production}/confirm', [ProductionController::class, 'confirm'])
            ->name('productions.confirm')
            ->middleware('permission:productions.index.confirm');
        Route::get('/work-day-sessions/today', [WorkDaySessionController::class, 'today'])->name('work-day-sessions.today');
        Route::post('/work-day-sessions/start', [WorkDaySessionController::class, 'start'])
            ->name('work-day-sessions.start')
            ->middleware('permission:productions.index.workday_start');
        Route::post('/work-day-sessions/{workDaySession}/close', [WorkDaySessionController::class, 'close'])
            ->name('work-day-sessions.close')
            ->middleware('permission:productions.index.workday_close');
        Route::resource('productions', ProductionController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:productions.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:productions.index.edit')
            ->middlewareFor('destroy', 'permission:productions.index.delete');
    });

    Route::middleware('permission:productions.ranking.view')->group(function () {
        Route::get('/productions/ranking', [ProductionController::class, 'ranking'])->name('productions.ranking');
    });

    // Nomina
    Route::middleware('permission:payrolls.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {payroll}.
        Route::get('/payrolls/export-list', [PayrollController::class, 'exportList'])
            ->name('payrolls.export-list')
            ->middleware('permission:payrolls.index.export');
        Route::resource('payrolls', PayrollController::class)->except(['edit', 'update'])
            ->middlewareFor(['create', 'store'], 'permission:payrolls.index.create')
            ->middlewareFor('destroy', 'permission:payrolls.index.delete')
            ->middlewareFor('show', 'permission:payrolls.show.view');
        Route::post('/payrolls/{payroll}/calculate', [PayrollController::class, 'calculate'])
            ->name('payrolls.calculate')
            ->middleware('permission:payrolls.show.calculate');
        Route::post('/payrolls/{payroll}/approve', [PayrollController::class, 'approve'])
            ->name('payrolls.approve')
            ->middleware('permission:payrolls.show.approve');
        Route::post('/payrolls/{payroll}/pay', [PayrollController::class, 'pay'])
            ->name('payrolls.pay')
            ->middleware('permission:payrolls.show.pay');
        Route::get('/payrolls/{payroll}/export', [PayrollController::class, 'export'])
            ->name('payrolls.export')
            ->middleware('permission:payrolls.show.export');
        // Ficha y comprobante de un empleado dentro de la nomina.
        Route::get('/payrolls/{payroll}/empleados/{payrollEmployee}', [PayrollController::class, 'employee'])
            ->name('payrolls.payroll-employees.show')
            ->middleware('permission:payrolls.employee.view');
        Route::get('/payrolls/{payroll}/empleados/{payrollEmployee}/comprobante', [PayrollController::class, 'receipt'])
            ->name('payrolls.payroll-employees.receipt')
            ->middleware('permission:payrolls.employee.receipt');
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
        // Antes del resource: un segmento literal no puede quedar detras de {payroll_concept}.
        Route::post('/payroll-concepts/reorder', [PayrollConceptController::class, 'reorder'])
            ->name('payroll-concepts.reorder')
            ->middleware('permission:payroll_concepts.index.reorder');
        Route::patch('/payroll-concepts/{payroll_concept}/toggle', [PayrollConceptController::class, 'toggleActive'])
            ->name('payroll-concepts.toggle')
            ->middleware('permission:payroll_concepts.index.toggle');
        Route::resource('payroll-concepts', PayrollConceptController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:payroll_concepts.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:payroll_concepts.index.edit')
            ->middlewareFor('destroy', 'permission:payroll_concepts.index.delete');
    });

    Route::middleware('permission:payroll_legal_parameters.index.view')->group(function () {
        Route::resource('payroll-legal-parameters', PayrollLegalParameterController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:payroll_legal_parameters.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:payroll_legal_parameters.index.edit')
            ->middlewareFor('destroy', 'permission:payroll_legal_parameters.index.delete');
    });

    Route::middleware('permission:holidays.index.view')->group(function () {
        Route::post('/holidays/sync', [HolidayController::class, 'sync'])
            ->name('holidays.sync')
            ->middleware('permission:holidays.index.sync');
        Route::resource('holidays', HolidayController::class)->only(['index', 'store', 'destroy'])
            ->middlewareFor('store', 'permission:holidays.index.create')
            ->middlewareFor('destroy', 'permission:holidays.index.delete');
    });

    // Anticipos
    Route::middleware('permission:advances.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {advance}.
        Route::get('/advances/export', [AdvanceController::class, 'export'])
            ->name('advances.export')
            ->middleware('permission:advances.index.export');
        Route::get('/advances/{advance}/receipt', [AdvanceController::class, 'receipt'])
            ->name('advances.receipt')
            ->middleware('permission:advances.show.receipt');
        Route::resource('advances', AdvanceController::class)->except(['show', 'edit', 'update'])
            ->middlewareFor(['create', 'store'], 'permission:advances.index.create')
            ->middlewareFor('destroy', 'permission:advances.index.delete');
        Route::get('/advances/{advance}', [AdvanceController::class, 'show'])
            ->name('advances.show')
            ->middleware('permission:advances.show.view');
    });

    // Gastos (solo usuarios de empresa; policies bloquean super_admin)
    Route::middleware('permission:expenses.categories.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {expense_category}.
        Route::post('/expense-categories/reorder', [ExpenseCategoryController::class, 'reorder'])
            ->name('expense-categories.reorder')
            ->middleware('permission:expenses.categories.reorder');
        Route::patch('/expense-categories/{expense_category}/toggle', [ExpenseCategoryController::class, 'toggleActive'])
            ->name('expense-categories.toggle')
            ->middleware('permission:expenses.categories.toggle');
        Route::resource('expense-categories', ExpenseCategoryController::class)->except(['show'])
            ->middlewareFor(['create', 'store'], 'permission:expenses.categories.create')
            ->middlewareFor(['edit', 'update'], 'permission:expenses.categories.edit')
            ->middlewareFor('destroy', 'permission:expenses.categories.delete');
    });

    Route::middleware('permission:expenses.index.view')->group(function () {
        // Antes del resource: un segmento literal no puede quedar detras de {expense}.
        Route::get('/expenses/export', [ExpenseController::class, 'export'])
            ->name('expenses.export')
            ->middleware('permission:expenses.index.export');
        Route::post('/expenses/quick', [ExpenseController::class, 'quickStore'])
            ->name('expenses.quick-store')
            ->middleware('permission:expenses.index.quick_create');
        Route::resource('expenses', ExpenseController::class)
            ->middlewareFor(['create', 'store'], 'permission:expenses.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:expenses.index.edit')
            ->middlewareFor('destroy', 'permission:expenses.index.delete')
            ->middlewareFor('show', 'permission:expenses.show.view');
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
        Route::resource('users', UserController::class)
            ->middlewareFor(['create', 'store'], 'permission:users.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:users.index.edit')
            ->middlewareFor('destroy', 'permission:users.index.delete')
            ->middlewareFor('show', 'permission:users.show.view');
        // Permisos por usuario: el catalogo que se pinta en el asignador y su guardado.
        Route::get('/users/{user}/permissions', [UserController::class, 'permissions'])
            ->name('users.permissions.show')
            ->middleware('permission:users.edit.permission_overrides')
            ->can('managePermissionOverrides', 'user');
        Route::put('/users/{user}/permissions', [UserController::class, 'updatePermissions'])
            ->name('users.permissions.update')
            ->middleware('permission:users.edit.permission_overrides')
            ->can('managePermissionOverrides', 'user');
        Route::put('/users/{user}/permission-overrides', [UserController::class, 'updatePermissionOverrides'])
            ->name('users.permission-overrides.update')
            ->middleware('permission:users.edit.permission_overrides')
            ->can('managePermissionOverrides', 'user');
    });

    // Roles y Permisos
    Route::middleware('permission:roles.index.view')->group(function () {
        Route::get('/roles/permission-matrix', [RoleController::class, 'permissionMatrix'])->name('roles.permission-matrix');
        Route::post('/roles/{role}/propagate', [RoleController::class, 'propagate'])
            ->name('roles.propagate')
            ->middleware('permission:roles.index.propagate');
        Route::resource('roles', RoleController::class)
            ->middlewareFor(['create', 'store'], 'permission:roles.index.create')
            ->middlewareFor(['edit', 'update'], 'permission:roles.index.edit')
            ->middlewareFor('destroy', 'permission:roles.index.delete');
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
        // GET y PUT comparten nombre: la pantalla de visibilidad y el guardado de la misma.
        Route::get('dashboard-widgets/{dashboard_widget}/visibility', [DashboardWidgetController::class, 'visibility'])->name('dashboard-widgets.visibility');
        Route::put('dashboard-widgets/{dashboard_widget}/visibility', [DashboardWidgetController::class, 'updateVisibility'])->name('dashboard-widgets.visibility.update');
        Route::patch('dashboard-widgets/{dashboard_widget}/toggle-active', [DashboardWidgetController::class, 'toggleActive'])->name('dashboard-widgets.toggle-active');
        Route::post('dashboard-widgets/{dashboard_widget}/duplicate', [DashboardWidgetController::class, 'duplicate'])->name('dashboard-widgets.duplicate');
        Route::resource('dashboard-widgets', DashboardWidgetController::class)->except(['show']);
    });
});

require __DIR__.'/auth.php';
