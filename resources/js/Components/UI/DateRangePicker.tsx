import { Input } from './Input';

interface DateRangePickerProps {
    startDate?: string;
    endDate?: string;
    onChange: (range: { start: string; end: string }) => void;
    className?: string;
}

export function DateRangePicker({ startDate = '', endDate = '', onChange, className }: DateRangePickerProps) {
    return (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className ?? ''}`}>
            <Input
                type="date"
                label="Desde"
                value={startDate}
                onChange={(e) => onChange({ start: e.target.value, end: endDate })}
            />
            <Input
                type="date"
                label="Hasta"
                value={endDate}
                onChange={(e) => onChange({ start: startDate, end: e.target.value })}
                min={startDate || undefined}
            />
        </div>
    );
}

export default DateRangePicker;
