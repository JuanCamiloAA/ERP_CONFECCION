import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { weekdayName, type HolidayRow } from '@/lib/holidays';
import { formatDate } from '@/lib/utils';

/**
 * El festivo seleccionado y lo que significa para la nomina.
 *
 * «Trasladado: Sí» no le sirve a nadie: lo que hay que saber es en que dia se liquida el
 * recargo, y por que.
 */
export function HolidayDetailCard({ holiday }: { holiday: HolidayRow }) {
    return (
        <EmployeeAsideCard
            title="Día seleccionado"
            subtitle={`${formatDate(holiday.date)} · ${weekdayName(holiday.date)}`}
        >
            <p className="mt-2 text-[15px]" style={{ color: 'var(--emp-text)' }}>
                {holiday.name}
            </p>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className={`emp-pill ${holiday.source === 'manual' ? 'emp-pill-accent' : ''}`}>
                    {holiday.source === 'manual' ? 'Agregado a mano' : 'Festivo de ley'}
                </span>
                {holiday.original_date ? (
                    <span className="emp-pill">Trasladado desde {formatDate(holiday.original_date)}</span>
                ) : null}
            </div>

            <p className="emp-note mt-3">
                {holiday.is_emiliani_shifted ? (
                    <>
                        La Ley 51 de 1983 traslada este festivo al lunes siguiente. La nómina liquida el recargo en el
                        lunes, no en la fecha original.
                    </>
                ) : holiday.source === 'manual' ? (
                    <>
                        Festivo agregado a mano: la sincronización no lo borra. Las horas trabajadas ese día llevan
                        recargo dominical y festivo.
                    </>
                ) : (
                    <>
                        Fecha fija por ley: no se traslada. Las horas trabajadas ese día llevan recargo dominical y
                        festivo.
                    </>
                )}
            </p>
        </EmployeeAsideCard>
    );
}

export default HolidayDetailCard;
