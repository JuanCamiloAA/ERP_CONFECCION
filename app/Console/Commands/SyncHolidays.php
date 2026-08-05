<?php

namespace App\Console\Commands;

use App\Services\HolidayService;
use Illuminate\Console\Command;

class SyncHolidays extends Command
{
    protected $signature = 'holidays:sync {year? : Un solo año a sincronizar} {--from=} {--to=}';

    protected $description = 'Calcula y guarda los festivos colombianos (Pascua + Ley Emiliani) para un año o rango de años.';

    public function handle(HolidayService $service): int
    {
        $year = $this->argument('year');
        $from = $this->option('from');
        $to = $this->option('to');

        if ($from || $to) {
            $from = (int) ($from ?? now()->year);
            $to = (int) ($to ?? $from);
        } elseif ($year) {
            $from = $to = (int) $year;
        } else {
            $from = $to = (int) now()->year;
        }

        if ($to < $from) {
            $this->error('El año --to no puede ser menor que --from.');

            return self::FAILURE;
        }

        for ($y = $from; $y <= $to; $y++) {
            $count = $service->syncYear($y);
            $this->info("Festivos {$y}: {$count} sincronizados.");
        }

        return self::SUCCESS;
    }
}
