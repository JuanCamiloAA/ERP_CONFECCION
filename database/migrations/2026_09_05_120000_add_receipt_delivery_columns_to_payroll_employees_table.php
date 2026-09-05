<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rastro del envio del comprobante por correo.
 *
 * No bloquea nada: reenviar es una operacion legitima y frecuente (el empleado borro el
 * correo, cambio de direccion, el adjunto no le llego). Estas columnas solo responden
 * «a quien ya le mande y cuando», que es lo que evita mandar dos veces por descuido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->timestamp('receipt_sent_at')->nullable()->after('notes');
            $table->string('receipt_sent_to')->nullable()->after('receipt_sent_at');
            $table->unsignedInteger('receipt_sent_count')->default(0)->after('receipt_sent_to');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_employees', function (Blueprint $table) {
            $table->dropColumn(['receipt_sent_at', 'receipt_sent_to', 'receipt_sent_count']);
        });
    }
};
