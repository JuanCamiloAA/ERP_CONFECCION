import { useCallback, useMemo, useState } from 'react';
import type { AbsenceEdit, AdvanceEdit, SessionEdit } from '@/lib/payrolls';

export interface PayrollEditors {
    sessionEdits: Record<string, SessionEdit>;
    absenceEdits: Record<string, AbsenceEdit>;
    advanceEdits: Record<string, AdvanceEdit>;
    setSessionEdit: (key: string, patch: Partial<SessionEdit>, fallback: SessionEdit) => void;
    setAbsenceEdit: (key: string, patch: Partial<AbsenceEdit>, fallback: AbsenceEdit) => void;
    setAdvanceEdit: (key: string, value: string) => void;
    reset: () => void;
    /** Hay algo capturado sin guardar; habilita «Descartar» y avisa antes de recalcular. */
    dirty: boolean;
}

/**
 * Estado de captura del detalle de nomina, compartido por escritorio y movil.
 *
 * Las tres tablas se indexan por la misma clave (`empleado:sesion`, `empleado:fecha`,
 * `empleado:anticipo`), de modo que la tarjeta del telefono y la tabla del escritorio
 * escriben en el mismo sitio y los constructores de payload recogen lo capturado desde
 * cualquiera de las dos vistas.
 */
export function usePayrollEdits(): PayrollEditors {
    const [sessionEdits, setSessionEdits] = useState<Record<string, SessionEdit>>({});
    const [absenceEdits, setAbsenceEdits] = useState<Record<string, AbsenceEdit>>({});
    const [advanceEdits, setAdvanceEdits] = useState<Record<string, AdvanceEdit>>({});

    const setSessionEdit = useCallback((key: string, patch: Partial<SessionEdit>, fallback: SessionEdit) => {
        setSessionEdits((prev) => ({ ...prev, [key]: { ...fallback, ...prev[key], ...patch } }));
    }, []);

    const setAbsenceEdit = useCallback((key: string, patch: Partial<AbsenceEdit>, fallback: AbsenceEdit) => {
        setAbsenceEdits((prev) => ({ ...prev, [key]: { ...fallback, ...prev[key], ...patch } }));
    }, []);

    const setAdvanceEdit = useCallback((key: string, value: string) => {
        setAdvanceEdits((prev) => ({ ...prev, [key]: { applied_amount: value } }));
    }, []);

    const reset = useCallback(() => {
        setSessionEdits({});
        setAbsenceEdits({});
        setAdvanceEdits({});
    }, []);

    const dirty = useMemo(
        () =>
            Object.keys(sessionEdits).length > 0 ||
            Object.keys(absenceEdits).length > 0 ||
            Object.keys(advanceEdits).length > 0,
        [sessionEdits, absenceEdits, advanceEdits],
    );

    return {
        sessionEdits,
        absenceEdits,
        advanceEdits,
        setSessionEdit,
        setAbsenceEdit,
        setAdvanceEdit,
        reset,
        dirty,
    };
}

export default usePayrollEdits;
