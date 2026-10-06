<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Estado de la membresia: prueba, activa, gracia o suspendida.
 *
 * Hasta hoy una membresia vencida bloqueaba el inicio de sesion de toda la empresa. Desde
 * aqui pasa por gracia (trabaja normal unos dias) y luego por suspendida (solo puede entrar
 * a pagar). El estado de cada empresa existente se calcula con la misma regla que usara el
 * proceso diario, para que nadie cambie de situacion entre la migracion y la primera corrida.
 *
 * El acceso dura hasta el final del dia de `membership_ends_at`, como antes: la gracia
 * empieza el dia siguiente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('membership_plans', function (Blueprint $table) {
            $table->unsignedSmallInteger('trial_days')->default(0)->after('price_monthly');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->foreignId('billing_cycle_id')->nullable()->after('membership_plan_id')
                ->constrained('billing_cycles')->nullOnDelete();
            $table->string('membership_status', 20)->default('activa')->after('billing_cycle_id');
            $table->dateTime('grace_ends_at')->nullable()->after('membership_ends_at');

            // El proceso diario busca por estado y fecha; sin indice recorre la tabla entera.
            $table->index(['membership_status', 'membership_ends_at']);
        });

        $monthly = DB::table('billing_cycles')->where('code', 'mensual')->value('id');
        $graceDays = max(0, (int) config('membership.grace_days', 5));
        $today = Carbon::today();

        foreach (DB::table('companies')->get(['id', 'membership_plan_id', 'membership_ends_at']) as $company) {
            $status = 'activa';
            $graceEndsAt = null;

            if ($company->membership_ends_at !== null) {
                $endsDay = Carbon::parse($company->membership_ends_at)->startOfDay();

                if ($endsDay->lt($today)) {
                    $graceEndsAt = $endsDay->copy()->addDay()->addDays($graceDays);
                    $status = $graceEndsAt->isFuture() ? 'gracia' : 'suspendida';
                }
            }

            DB::table('companies')->where('id', $company->id)->update([
                'billing_cycle_id' => $company->membership_plan_id ? $monthly : null,
                'membership_status' => $status,
                'grace_ends_at' => $graceEndsAt,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropIndex(['membership_status', 'membership_ends_at']);
            $table->dropConstrainedForeignId('billing_cycle_id');
            $table->dropColumn(['membership_status', 'grace_ends_at']);
        });

        Schema::table('membership_plans', function (Blueprint $table) {
            $table->dropColumn('trial_days');
        });
    }
};
