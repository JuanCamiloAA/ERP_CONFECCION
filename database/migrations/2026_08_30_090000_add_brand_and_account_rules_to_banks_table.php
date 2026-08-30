<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identidad y reglas de cuenta de cada banco.
 *
 * Hasta ahora un banco era un nombre y un codigo, asi que quien capturaba los datos de pago
 * de un empleado tenia que saberse de memoria cuantos digitos pide cada entidad y si hace
 * falta clave de dispersion. Esas reglas pasan a vivir junto al banco y la ficha del
 * empleado las lee de ahi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banks', function (Blueprint $table) {
            // Ruta del objeto, no URL: el disco real depende de la configuracion (local o
            // Firebase) y la URL se resuelve al serializar.
            $table->string('logo_path')->nullable()->after('name');
            $table->string('brand_color', 7)->nullable()->after('logo_path');
            $table->string('type', 20)->default('bank')->after('brand_color');
            $table->string('account_format', 40)->nullable()->after('type');
            $table->string('account_hint', 120)->nullable()->after('account_format');
            $table->boolean('requires_key')->default(true)->after('account_hint');
            $table->text('notes')->nullable()->after('requires_key');
        });
    }

    public function down(): void
    {
        Schema::table('banks', function (Blueprint $table) {
            $table->dropColumn([
                'logo_path',
                'brand_color',
                'type',
                'account_format',
                'account_hint',
                'requires_key',
                'notes',
            ]);
        });
    }
};
