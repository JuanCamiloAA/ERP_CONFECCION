<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitacora por empleado: quien toco que, cuando y con que valor anterior.
 *
 * `actor_name` guarda el nombre del autor en el momento del hecho, no solo su id: el
 * usuario puede borrarse o cambiar de nombre, y una bitacora que dice «—» no sirve de
 * nada. El id se conserva aparte para poder enlazar cuando sigue existiendo.
 *
 * Los valores son texto, no json: lo que se pinta es una linea legible, y el numero ya
 * viene formateado desde quien registra el hecho. Los datos sensibles (cuenta bancaria,
 * clave, contrasena) se guardan ya enmascarados; la bitacora nunca los almacena en claro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name', 160)->nullable();
            $table->string('event', 60);
            $table->string('field', 80)->nullable();
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'created_at']);
            $table->index(['company_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_audit_logs');
    }
};
