<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Campos de «Mi perfil» para las cuentas de acceso.
 *
 * Lo que la pantalla necesita saber de verdad y hasta hoy no existia: el cargo, cuando se
 * cambio la contrasena por ultima vez, que avisos quiere recibir la persona y el estado de
 * la verificacion en dos pasos.
 *
 * No se agrega `photo_path`: la columna `avatar` ya existe desde la creacion de la tabla y
 * es la que resuelve `ResolvesMediaUrlsInArray`. Una segunda columna con la misma foto solo
 * podria desincronizarse —el mismo criterio que se aplico a `photo` en `employees`.
 *
 * `password_changed_at` se rellena con `created_at`. Es el unico instante en que consta que
 * la contrasena existia; si desde entonces se cambio sin registrarlo, la antiguedad que
 * muestra la pantalla sale MAYOR de la real, que es el lado seguro del error: como mucho
 * invita a cambiarla antes de tiempo, nunca da por nueva una contrasena vieja.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('job_title', 120)->nullable()->after('phone');
            $table->timestamp('password_changed_at')->nullable()->after('password_change_required');
            $table->json('notification_preferences')->nullable()->after('dashboard_layout');

            // El secreto y los codigos de respaldo se guardan cifrados por el cast del
            // modelo; el tipo es texto porque el cifrado alarga mucho el valor.
            $table->text('two_factor_secret')->nullable()->after('password_changed_at');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');

            // Correo propuesto. El vigente no cambia hasta que se confirma desde el enlace
            // enviado a la direccion nueva: es lo que impide quedarse fuera por un error al
            // teclear, y lo que prueba que esa bandeja es de quien dice.
            $table->string('pending_email', 120)->nullable()->after('email_verified_at');
            $table->timestamp('pending_email_requested_at')->nullable()->after('pending_email');
        });

        DB::table('users')
            ->whereNull('password_changed_at')
            ->update(['password_changed_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'job_title',
                'password_changed_at',
                'notification_preferences',
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'pending_email',
                'pending_email_requested_at',
            ]);
        });
    }
};
