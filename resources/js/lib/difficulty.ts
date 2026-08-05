export const DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS = [3, 7, 15, 25];

export const DIFFICULTY_LABELS: Record<number, string> = {
    1: 'Muy baja',
    2: 'Baja',
    3: 'Media',
    4: 'Alta',
    5: 'Muy alta',
};

/** Espejo de App\Support\OperationDifficulty::levelFromMinutes (autoridad real: el backend). Solo para previsualizar antes de guardar. */
export function levelFromMinutes(minutes: number, thresholds: number[] = DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS): number {
    for (let i = 0; i < thresholds.length; i++) {
        if (minutes <= thresholds[i]) return i + 1;
    }
    return 5;
}

export function difficultyLabel(level: number | null | undefined): string {
    if (!level) return '—';
    return DIFFICULTY_LABELS[level] ?? String(level);
}
