<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Solicitudes que el empleado hace sobre su propia ficha.
 *
 * Una sola tabla para los tres tipos (anticipo, cambio de datos, correccion de
 * produccion) en vez de tres: el ciclo es identico —se crea, alguien la revisa, se
 * aprueba o se rechaza con motivo— y la bandeja de aprobaciones tiene que poder
 * ordenarlas juntas. Lo que cambia entre tipos es el contenido, y eso vive en `payload`.
 *
 * El dato vigente del empleado no se toca al crear la solicitud: solo al aprobarla.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            // Quien la radico. Casi siempre el propio empleado, pero queda explicito
            // porque un administrador tambien puede radicarla en su nombre.
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 40);
            $table->json('payload');
            $table->string('status', 20)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            // La bandeja pide «pendientes de esta empresa» y la ficha «las de este
            // empleado»: un indice para cada lectura.
            $table->index(['company_id', 'status']);
            $table->index(['employee_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_requests');
    }
};
