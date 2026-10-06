<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitacora de la membresia: cada cambio de plan, renovacion, gracia, suspension o ajuste
 * manual, con quien lo hizo. Solo se agrega, nunca se edita.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_membership_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40);
            $table->json('data')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('created_at')->nullable();

            $table->index(['company_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_membership_events');
    }
};
