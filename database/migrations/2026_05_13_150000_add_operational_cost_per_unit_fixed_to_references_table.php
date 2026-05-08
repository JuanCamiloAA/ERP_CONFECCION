<?php

use App\Models\Reference;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('references', function (Blueprint $table) {
            $table->decimal('operational_cost_per_unit_fixed', 12, 2)->nullable()->after('payment_per_unit');
            $table->unsignedInteger('operational_lot_qty_at_cost_fix')->nullable()->after('operational_cost_per_unit_fixed');
        });

        Reference::query()->withoutGlobalScopes()->chunkById(100, function ($references): void {
            foreach ($references as $reference) {
                $sum = (float) DB::table('reference_operations')->where('reference_id', $reference->id)->sum('price');
                $reference->forceFill([
                    'operational_cost_per_unit_fixed' => round($sum, 2),
                    'operational_lot_qty_at_cost_fix' => $reference->lot_total_quantity,
                ])->saveQuietly();
            }
        });
    }

    public function down(): void
    {
        Schema::table('references', function (Blueprint $table) {
            $table->dropColumn(['operational_cost_per_unit_fixed', 'operational_lot_qty_at_cost_fix']);
        });
    }
};
