<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tarjeta con la que se cobra la membresia de una empresa.
 *
 * Aqui NO se guarda el numero de tarjeta ni el CVC: solo lo que la pasarela devuelve tras
 * tokenizar —una referencia opaca, la marca, los cuatro ultimos digitos y el vencimiento—,
 * que es lo unico que hace falta para mostrar «Visa ···· 4242» y para volver a cobrar. Es
 * un requisito de PCI-DSS, no una preferencia: guardar el PAN obligaria a certificar toda
 * la aplicacion.
 *
 * Unico por empresa: hoy solo se soporta una tarjeta activa. La tabla es propia y no unas
 * columnas mas en `companies` para poder admitir varias mañana sin migrar datos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->string('gateway_token');
            $table->string('brand');
            $table->string('last4', 4);
            $table->unsignedTinyInteger('expiry_month');
            $table->unsignedSmallInteger('expiry_year');
            $table->string('holder_name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_payment_methods');
    }
};
