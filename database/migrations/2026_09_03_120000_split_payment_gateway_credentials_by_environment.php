<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Las credenciales pasan a guardarse por entorno.
 *
 * Antes habia un solo juego de llaves y el selector de entorno solo cambiaba contra que
 * host se firmaba: al pasar de pruebas a produccion habia que reescribir las cuatro
 * credenciales, y la pantalla mostraba las mismas en los dos lados. Ahora cada entorno
 * tiene las suyas y el selector decide cual se usa, que es lo que se esperaba de el.
 *
 * `payment_gateway_settings` se queda con lo que si es global: que entorno esta en uso y
 * si los cobros estan encendidos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateway_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('wompi');
            $table->string('environment');
            $table->string('public_key')->nullable();
            // Cifradas (cast `encrypted`): ocupan mas que el valor original.
            $table->text('private_key')->nullable();
            $table->text('events_secret')->nullable();
            $table->text('integrity_secret')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['provider', 'environment']);
        });

        // Lo que ya hubiera cargado se conserva, en el entorno donde estaba puesto.
        $existing = DB::table('payment_gateway_settings')->get();
        $now = now();

        foreach ($existing as $row) {
            DB::table('payment_gateway_credentials')->insertOrIgnore([
                'provider' => $row->provider,
                'environment' => $row->environment,
                'public_key' => $row->public_key,
                'private_key' => $row->private_key,
                'events_secret' => $row->events_secret,
                'integrity_secret' => $row->integrity_secret,
                'updated_by_user_id' => $row->updated_by_user_id ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->dropColumn(['public_key', 'private_key', 'events_secret', 'integrity_secret']);
        });
    }

    public function down(): void
    {
        Schema::table('payment_gateway_settings', function (Blueprint $table) {
            $table->string('public_key')->nullable()->after('environment');
            $table->text('private_key')->nullable()->after('public_key');
            $table->text('events_secret')->nullable()->after('private_key');
            $table->text('integrity_secret')->nullable()->after('events_secret');
        });

        // Se devuelven las del entorno que estuviera en uso; las del otro se pierden, que
        // es lo inevitable al volver a un solo juego de llaves.
        foreach (DB::table('payment_gateway_settings')->get() as $row) {
            $credential = DB::table('payment_gateway_credentials')
                ->where('provider', $row->provider)
                ->where('environment', $row->environment)
                ->first();

            if ($credential === null) {
                continue;
            }

            DB::table('payment_gateway_settings')->where('id', $row->id)->update([
                'public_key' => $credential->public_key,
                'private_key' => $credential->private_key,
                'events_secret' => $credential->events_secret,
                'integrity_secret' => $credential->integrity_secret,
            ]);
        }

        Schema::dropIfExists('payment_gateway_credentials');
    }
};
