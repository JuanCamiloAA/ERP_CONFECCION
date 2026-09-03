<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campos de facturacion de la membresia en la empresa.
 *
 * Nada de esto es dato sensible de tarjeta: `payment_customer_id` es el identificador que
 * la pasarela entrega para referirse al cliente, no un medio de pago. El numero de tarjeta
 * y el CVC no se guardan aqui ni en ningun otro sitio (ver `company_payment_methods`).
 *
 * `next_charge_at` nace igualado a `membership_ends_at` porque hoy la renovacion es manual
 * y esa es la fecha que ya se venia usando; cuando exista pasarela, el comando diario la
 * adelanta sola tras cada cobro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('payment_gateway')->nullable()->after('membership_ends_at');
            $table->string('payment_customer_id')->nullable()->after('payment_gateway');
            $table->boolean('auto_debit_enabled')->default(false)->after('payment_customer_id');
            $table->date('next_charge_at')->nullable()->after('auto_debit_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'payment_gateway',
                'payment_customer_id',
                'auto_debit_enabled',
                'next_charge_at',
            ]);
        });
    }
};
