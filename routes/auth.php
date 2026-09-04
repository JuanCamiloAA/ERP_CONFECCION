<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\CompanySignupController;
use App\Http\Controllers\Auth\PasswordResetController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    // El alta crea un registro pendiente y manda al checkout; la empresa no existe hasta
    // que Wompi aprueba el primer mes (ver CompanySignupController).
    Route::get('register', [CompanySignupController::class, 'create'])->name('register');
    Route::post('register', [CompanySignupController::class, 'store']);

    Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('forgot-password', [PasswordResetController::class, 'showForgot'])->name('password.request');
    Route::post('forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');

    Route::get('reset-password/{token}', [PasswordResetController::class, 'showReset'])->name('password.reset');
    Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.store');
});

/*
 * Vuelta del checkout. Fuera del grupo `guest`: si el pago se aprueba se inicia sesion
 * sola, y al recargar esa misma URL ya autenticado `guest` la rebotaria.
 */
Route::get('registro/estado/{reference}', [CompanySignupController::class, 'status'])
    ->name('signup.status');

Route::middleware('auth')->group(function () {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
});
