<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Periodos de pago de la membresia (mensual, trimestral...). Catalogo de plataforma.
 *
 * El plan guarda solo su precio mensual; lo que vale en cada periodo lo calcula
 * `MembershipPricing` con los meses y el descuento de aqui.
 */
return new class extends Migration
{
    protected const CYCLES = [
        ['code' => 'mensual', 'name' => 'Mensual', 'months' => 1, 'discount_percent' => 0],
        ['code' => 'trimestral', 'name' => 'Trimestral', 'months' => 3, 'discount_percent' => 5],
        ['code' => 'semestral', 'name' => 'Semestral', 'months' => 6, 'discount_percent' => 10],
        ['code' => 'anual', 'name' => 'Anual', 'months' => 12, 'discount_percent' => 15],
    ];

    public function up(): void
    {
        Schema::create('billing_cycles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('code', 40)->unique();
            $table->unsignedTinyInteger('months');
            $table->unsignedTinyInteger('discount_percent')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $now = now();

        DB::table('billing_cycles')->insert(array_map(fn (array $cycle, int $order) => [
            ...$cycle,
            'is_active' => true,
            'sort_order' => $order,
            'created_at' => $now,
            'updated_at' => $now,
        ], self::CYCLES, array_keys(self::CYCLES)));
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_cycles');
    }
};
