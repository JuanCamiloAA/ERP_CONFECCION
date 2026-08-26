import type { Advance, PayrollEmployee, WorkDaySession } from '@/types';

/**
 * El flujo de una nomina y todo lo que se deriva de el.
 *
 * La pantalla entera cuelga de aqui: la barra de pasos, la etiqueta «Paso 2 de 4», el boton
 * de la accion siguiente y los permisos que se comprueban. Con la logica repartida entre el
 * listado, el detalle y la vista movil bastaba con tocar un caso para que los otros dos
 * dijeran algo distinto del mismo periodo.
 */
export const PAYROLL_FLOW = ['borrador', 'calculado', 'aprobado', 'pagado'] as const;

export type PayrollStatus = (typeof PAYROLL_FLOW)[number];

/** Indice 0..3 dentro del flujo; -1 si llega un estado desconocido. */
export const flowStep = (status: PayrollStatus): number => PAYROLL_FLOW.indexOf(status);

/**
 * Una nomina aprobada o pagada esta cerrada: ya no admite recalculo ni ajustes, y borrarla
 * deshace el cierre (produccion y anticipos vuelven atras).
 */
export const isClosed = (status: PayrollStatus): boolean => status === 'aprobado' || status === 'pagado';

export type PayrollActionKey = 'calculate' | 'approve' | 'pay' | 'export';

export type PayrollIconName = 'Calculator' | 'CheckCircle' | 'Money' | 'Printer';

export interface PayrollNextAction {
    label: string;
    icon: PayrollIconName;
    permission: string;
    action: PayrollActionKey;
    hint: string;
}

/** Accion siguiente: etiqueta, icono, permiso y ruta POST. Una sola fuente para listado, detalle y movil. */
export function nextAction(status: PayrollStatus): PayrollNextAction {
    switch (status) {
        case 'borrador':
            return {
                label: 'Calcular',
                icon: 'Calculator',
                permission: 'payrolls.show.calculate',
                action: 'calculate',
                hint: 'Procesa producción, jornadas y recargos del periodo.',
            };
        case 'calculado':
            return {
                label: 'Aprobar',
                icon: 'CheckCircle',
                permission: 'payrolls.show.approve',
                action: 'approve',
                hint: 'Aprobar cierra los ajustes de jornada y los conceptos manuales.',
            };
        case 'aprobado':
            return {
                label: 'Marcar pagada',
                icon: 'Money',
                permission: 'payrolls.show.pay',
                action: 'pay',
                hint: 'Descuenta los anticipos y habilita los comprobantes.',
            };
        default:
            return {
                label: 'Comprobantes',
                icon: 'Printer',
                permission: 'payrolls.show.view',
                action: 'export',
                hint: 'Periodo cerrado.',
            };
    }
}

export const stepLabel = (status: PayrollStatus): string =>
    status === 'pagado'
        ? 'Cerrada'
        : `Paso ${flowStep(status) + 1} de 4 · ${
              status === 'borrador' ? 'sin calcular' : status === 'calculado' ? 'falta aprobar' : 'falta marcar pagada'
          }`;

export const modeLabel = (mode?: string | null): string =>
    mode === 'fixed_daily' ? 'Salario diario' : mode === 'hourly_legal' ? 'Por horas (legal)' : 'Por operaciones';

/** Rotulo y pie de cada uno de los cuatro tramos de la cabecera del detalle. */
export const FLOW_STEP_LABELS: { status: PayrollStatus; title: string; meta: string }[] = [
    { status: 'borrador', title: 'Borrador', meta: 'periodo creado' },
    { status: 'calculado', title: 'Calculada', meta: 'producción y jornadas' },
    { status: 'aprobado', title: 'Aprobada', meta: 'cierra ajustes' },
    { status: 'pagado', title: 'Pagada', meta: 'genera comprobantes' },
];

/* -------------------------------------------------------------------------- cifras de fila */

export function employeeName(row: Pick<PayrollEmployee, 'employee'>): string {
    const name = `${row.employee?.first_name ?? ''} ${row.employee?.last_name ?? ''}`.trim();

    return name || 'Empleado';
}

/** Bruto devengado: producido + jornada + jornada legal + conceptos manuales. */
export function rowGross(row: PayrollEmployee): number {
    return (
        Number(row.production_total ?? 0) +
        Number(row.daily_work_subtotal ?? 0) +
        Number(row.legal_hourly_subtotal ?? 0) +
        Number(row.adjustments_subtotal ?? 0)
    );
}

export function deductionsTotal(row: PayrollEmployee): number {
    return ((row.deductions as Array<{ amount: number }>) ?? []).reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
}

/** Horas con un decimal fijo ("9,0"), para que la columna no salte de formato. */
export function hoursFromMinutes(minutes: number): string {
    return (Number(minutes || 0) / 60).toLocaleString('es-CO', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
}

export function sessionMinutes(sessions: WorkDaySession[]): number {
    return sessions.reduce((sum, s) => sum + Number(s.duration_minutes ?? 0), 0);
}

/** Hora corta de una marcación ISO; «—» cuando no hay. */
export function clockLabel(iso: string | null | undefined): string {
    if (!iso) return '—';

    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

/* ----------------------------------------------------- estado editable y payloads */

export interface SessionEdit {
    duration_minutes: string;
    reason: string;
}

export interface AbsenceEdit {
    discount: boolean;
    note: string;
}

export interface AdvanceEdit {
    applied_amount: string;
}

export const editKey = (employeeId: number, sessionId: number): string => `${employeeId}:${sessionId}`;

export const absenceKey = (employeeId: number, workDate: string): string => `${employeeId}:${workDate}`;

export const advanceKey = (employeeId: number, advanceId: number): string => `${employeeId}:${advanceId}`;

export interface AdjustmentBlock {
    employee_id: number;
    sessions: { session_id: number; duration_minutes?: number; reason?: string }[];
}

export interface AbsenceBlock {
    employee_id: number;
    dates: { date: string; discount: boolean; note: string | null }[];
}

export interface AdvanceBlock {
    employee_id: number;
    advances: { advance_id: number; applied_amount: number }[];
}

/**
 * Ajustes de jornada capturados. Solo viaja lo que de verdad cambio: mandar la duracion
 * original marcaria la sesion como ajustada sin que nadie la tocara.
 */
export function buildAdjustments(
    edits: Record<string, SessionEdit>,
    sessionsByEmp: Record<string, WorkDaySession[]>,
): AdjustmentBlock[] {
    const byEmp: Record<number, AdjustmentBlock['sessions']> = {};

    for (const [key, edit] of Object.entries(edits)) {
        const parts = key.split(':');
        const employeeId = Number(parts[0]);
        const sessionId = Number(parts[1]);
        if (!employeeId || !sessionId) continue;

        const list = sessionsByEmp[String(employeeId)] ?? [];
        const session = list.find((s) => s.id === sessionId);
        if (!session?.clock_out_at) continue;

        const origDm = Number(session.duration_minutes ?? 0);
        const rawDm = edit.duration_minutes.trim();
        const nextDm = rawDm === '' ? origDm : Number(rawDm);
        const durationChanged = rawDm !== '' && !Number.isNaN(nextDm) && nextDm !== origDm;
        const reason = edit.reason.trim();
        if (!durationChanged && !reason) continue;
        if (rawDm !== '' && Number.isNaN(Number(rawDm))) continue;

        const payload: AdjustmentBlock['sessions'][number] = { session_id: sessionId };
        if (durationChanged) payload.duration_minutes = Number(rawDm);
        if (reason) payload.reason = reason;

        byEmp[employeeId] = byEmp[employeeId] ?? [];
        byEmp[employeeId].push(payload);
    }

    return Object.entries(byEmp).map(([employee_id, sessions]) => ({
        employee_id: Number(employee_id),
        sessions,
    }));
}

/**
 * Inasistencias de TODOS los empleados de la nomina.
 *
 * Recalcular reevalua los dias sin marcacion desde cero: lo que no se reenvia vuelve al
 * valor por defecto de los parametros legales. Por eso se parte del estado ya guardado en
 * cada fila y solo se superpone lo que el admin acabe de tocar.
 */
export function buildAbsenceConfirmations(
    edits: Record<string, AbsenceEdit>,
    rows: PayrollEmployee[],
): AbsenceBlock[] {
    const byEmp: Record<number, AbsenceBlock['dates']> = {};

    rows.forEach((row) => {
        const detail = row.absence_discount_detail ?? [];
        if (!row.employee_id || detail.length === 0) return;

        detail.forEach((item) => {
            const k = absenceKey(row.employee_id, item.work_date);
            const state = edits[k] ?? { discount: item.confirmed, note: item.note ?? '' };
            byEmp[row.employee_id] = byEmp[row.employee_id] ?? [];
            byEmp[row.employee_id].push({
                date: item.work_date,
                discount: state.discount,
                note: state.note.trim() || null,
            });
        });
    });

    return Object.entries(byEmp).map(([employee_id, dates]) => ({
        employee_id: Number(employee_id),
        dates,
    }));
}

/**
 * Igual que `buildAbsenceConfirmations`, pero partiendo de un retrato del servidor con el
 * estado de toda la nomina. Lo usa la ficha del empleado, que solo tiene una fila cargada
 * y aun asi debe conservar las exclusiones de los demas al recalcular.
 */
export function buildAbsenceConfirmationsFromBaseline(
    edits: Record<string, AbsenceEdit>,
    baseline: AbsenceBlock[],
): AbsenceBlock[] {
    return baseline.map((block) => ({
        employee_id: block.employee_id,
        dates: block.dates.map((item) => {
            const state = edits[absenceKey(block.employee_id, item.date)];
            if (!state) return item;

            return { date: item.date, discount: state.discount, note: state.note.trim() || null };
        }),
    }));
}

/** Solo se incluyen los anticipos que el admin edito; los demas se descuentan por el saldo completo (default del backend). */
export function buildAdvanceAdjustments(
    edits: Record<string, AdvanceEdit>,
    rows: PayrollEmployee[],
): AdvanceBlock[] {
    const byEmp: Record<number, AdvanceBlock['advances']> = {};

    rows.forEach((row) => {
        const advances: Advance[] = row.advances ?? [];
        if (!row.employee_id || advances.length === 0) return;

        advances.forEach((adv) => {
            const state = edits[advanceKey(row.employee_id, adv.id)];
            if (!state) return;

            const raw = state.applied_amount.trim().replace(',', '.');
            if (raw === '') return;
            const amount = Number(raw);
            if (Number.isNaN(amount) || amount <= 0) return;

            byEmp[row.employee_id] = byEmp[row.employee_id] ?? [];
            byEmp[row.employee_id].push({ advance_id: adv.id, applied_amount: amount });
        });
    });

    return Object.entries(byEmp).map(([employee_id, advances]) => ({
        employee_id: Number(employee_id),
        advances,
    }));
}

/** Payload de `payrolls.calculate`: solo se envian las claves con contenido. */
export function calculatePayload(
    adjustments: AdjustmentBlock[],
    absences: AbsenceBlock[],
    advances: AdvanceBlock[],
): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (adjustments.length > 0) payload.employee_adjustments = adjustments;
    if (absences.length > 0) payload.absence_confirmations = absences;
    if (advances.length > 0) payload.advance_adjustments = advances;

    return payload;
}

/* -------------------------------------------------------------------- agrupacion por mes */

const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export interface PayrollMonthBucket<T> {
    key: string;
    label: string;
    rows: T[];
    total: number;
    unpaid: number;
}

/**
 * Agrupa por mes de `period_start` conservando el orden en que llegan: el backend ya ordena
 * por periodo descendente y reordenar aqui rompería la correspondencia con la paginacion.
 */
export function groupPayrollsByMonth<T extends { period_start: string; total_amount: string | number; status: PayrollStatus }>(
    rows: T[],
): PayrollMonthBucket<T>[] {
    const buckets = new Map<string, PayrollMonthBucket<T>>();

    rows.forEach((row) => {
        const iso = String(row.period_start).slice(0, 10);
        const [year, month] = iso.split('-');
        const key = `${year}-${month}`;
        const label = `${MONTHS[Number(month) - 1] ?? ''} ${year}`;

        const bucket = buckets.get(key) ?? {
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            rows: [],
            total: 0,
            unpaid: 0,
        };

        bucket.rows.push(row);
        bucket.total += Number(row.total_amount ?? 0);
        if (row.status !== 'pagado') bucket.unpaid += 1;

        buckets.set(key, bucket);
    });

    return [...buckets.values()];
}

/** «16/08 – 31/08»: el periodo en la forma corta que cabe en una columna. */
export function shortPeriod(start: string, end: string): string {
    const short = (iso: string) => {
        const [, month, day] = String(iso).slice(0, 10).split('-');

        return day && month ? `${day}/${month}` : '—';
    };

    return `${short(start)} – ${short(end)}`;
}
