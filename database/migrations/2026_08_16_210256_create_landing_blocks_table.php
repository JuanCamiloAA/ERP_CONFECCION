<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40)->index();
            $table->unsignedInteger('position')->index();
            $table->boolean('is_visible')->default(true);
            // data = borrador que edita el super usuario; published_data = lo que ve el publico.
            $table->json('data');
            $table->json('published_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_blocks');
    }
};
