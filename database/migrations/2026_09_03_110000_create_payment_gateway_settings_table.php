<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Configuracion de la pasarela de pagos, editable por el super admin.
 *
 * Una sola fila para toda la plataforma: el cobro de las membresias lo recibe el
 * proveedor del sistema, no cada empresa. Se guarda en base y no solo en `.env` para
 * poder cambiar de sandbox a produccion sin desplegar.
 *
 * Las tres credenciales van cifradas con la APP_KEY (cast `encrypted` en el modelo): una
 * llave privada en texto plano en la base es una llave privada regalada a cualquiera con
 * acceso de lectura o a un volcado de respaldo. Solo la llave publica queda legible,
 * porque de todos modos viaja al navegador.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateway_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('wompi');
            $table->string('environment')->default('sandbox');
            $table->string('public_key')->nullable();
            // `text` y no `string`: cifrados ocupan bastante mas que el valor original.
            $table->text('private_key')->nullable();
            $table->text('events_secret')->nullable();
            $table->text('integrity_secret')->nullable();
            // Apagado mientras no esten las llaves: sin esto, el primer cliente se toparia
            // con un checkout roto en vez de con un aviso.
            $table->boolean('is_enabled')->default(false);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('provider');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_gateway_settings');
    }
};
