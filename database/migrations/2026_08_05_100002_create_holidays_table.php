<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('holidays', function (Blueprint $table) {
            $table->id();
            $table->string('country_code', 2)->default('CO');
            $table->date('date');
            $table->string('name', 150);
            // true si se corrio al lunes siguiente (Ley 51 de 1983, "Ley Emiliani")
            $table->boolean('is_emiliani_shifted')->default(false);
            $table->enum('source', ['calculated', 'manual'])->default('calculated');
            $table->timestamps();

            $table->unique(['country_code', 'date']);
            $table->index(['country_code', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('holidays');
    }
};
