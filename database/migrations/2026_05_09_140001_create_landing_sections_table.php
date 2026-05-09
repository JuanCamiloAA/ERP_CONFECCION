<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_sections', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title_internal');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('status', 16)->default('live'); // draft|live
            $table->boolean('is_system')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->json('draft_payload')->nullable();
            $table->json('live_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_sections');
    }
};
