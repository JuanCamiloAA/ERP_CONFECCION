<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_globals', function (Blueprint $table) {
            $table->id();
            $table->string('site_name')->nullable();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->string('og_image_path')->nullable();
            $table->string('header_logo_path')->nullable();
            $table->string('favicon_path')->nullable();
            $table->string('footer_privacy_url')->nullable();
            $table->string('footer_terms_url')->nullable();
            $table->string('footer_contact_url')->nullable();
            $table->string('navbar_cta_text')->nullable();
            $table->string('navbar_cta_url')->nullable();
            $table->text('footer_legal_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_globals');
    }
};
