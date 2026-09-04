<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alta de empresa pendiente de pago.
 *
 * Los datos esperan aqui hasta que Wompi aprueba el primer mes; solo entonces se crean la
 * empresa, el usuario y su rol. Asi un checkout abandonado no deja una empresa muerta ni
 * deja el correo ocupado: quien no completo el pago puede volver a intentarlo con el mismo.
 *
 * La contraseña se guarda ya hasheada —nunca en claro— porque es la que tendra el
 * administrador cuando la cuenta se cree de verdad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_signups', function (Blueprint $table) {
            $table->id();
            // Referencia que viaja a Wompi y vuelve en el webhook; es la que ata el pago
            // con este registro, de ahi que sea unica.
            $table->string('reference')->unique();
            $table->foreignId('membership_plan_id')->constrained('membership_plans')->cascadeOnDelete();

            $table->string('company_name');
            $table->string('company_nit')->nullable();
            $table->string('company_phone')->nullable();
            $table->string('company_email')->nullable();

            $table->string('admin_name');
            $table->string('admin_last_name')->nullable();
            $table->string('admin_email');
            $table->string('admin_password');

            $table->unsignedBigInteger('amount_in_cents');
            $table->string('currency', 3)->default('COP');

            $table->enum('status', ['pendiente', 'pagado', 'fallido', 'expirado'])->default('pendiente');
            $table->string('transaction_id')->nullable();
            $table->string('transaction_status')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();

            // Se llena al aprobar el pago; deja el rastro de que salio de este registro.
            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();

            $table->timestamps();

            $table->index(['status', 'expires_at']);
            $table->index('admin_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_signups');
    }
};
