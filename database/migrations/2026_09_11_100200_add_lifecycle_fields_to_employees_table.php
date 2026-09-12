<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ciclo de vida del empleado y contacto de emergencia.
 *
 * Hasta hoy el unico estado era `is_active`, que solo dice si cuenta o no para nomina.
 * `lifecycle_status` es el estado real del proceso —contratado, documentos al dia,
 * acceso creado, activo, retirado— y es lo que alimenta el checklist de la ficha.
 * `is_active` se conserva intacto: todo el modulo de nomina, produccion y listados
 * depende de el, y duplicar su significado aqui romperia esos calculos.
 *
 * No se agrega `photo_path`: la columna `photo` ya existe desde la creacion de la tabla
 * y es la que resuelve `ResolvesMediaUrlsInArray`. Una segunda columna con el mismo
 * contenido solo abriria la puerta a que se desincronicen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('lifecycle_status', 30)->default('activo')->after('is_active');
            $table->string('emergency_contact_name', 120)->nullable()->after('address');
            $table->string('emergency_contact_phone', 40)->nullable()->after('emergency_contact_name');
            $table->date('termination_date')->nullable()->after('lifecycle_status');
            $table->string('termination_reason', 255)->nullable()->after('termination_date');
        });

        // Los inactivos que ya existen no son «activos» en el ciclo nuevo. No se puede
        // saber si fue retiro o suspension, asi que se marcan como retirados: es el unico
        // estado terminal y el que la ficha muestra sin prometer nada que no se sepa.
        DB::table('employees')->where('is_active', false)->update(['lifecycle_status' => 'retirado']);
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn([
                'lifecycle_status',
                'emergency_contact_name',
                'emergency_contact_phone',
                'termination_date',
                'termination_reason',
            ]);
        });
    }
};
