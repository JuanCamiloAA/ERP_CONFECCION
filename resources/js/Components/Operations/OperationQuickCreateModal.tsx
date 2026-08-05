import { usePage } from '@inertiajs/react';
import axios from 'axios';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';

export interface QuickCreatedOperation {
    id: number;
    name: string;
    base_price: string | number;
    estimated_minutes: string | number;
    difficulty_level: number;
    description: string | null;
    is_active: boolean;
}

interface OperationQuickCreateModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (operation: QuickCreatedOperation) => void;
}

const emptyForm = {
    name: '',
    description: '',
    base_price: '',
    estimated_minutes: '',
    is_active: true,
};

export function OperationQuickCreateModal({ open, onClose, onCreated }: OperationQuickCreateModalProps) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const [form, setForm] = useState(emptyForm);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const previewLevel = useMemo(() => {
        const minutes = Number(form.estimated_minutes);
        return form.estimated_minutes !== '' && Number.isFinite(minutes) && minutes > 0
            ? levelFromMinutes(minutes, thresholds)
            : null;
    }, [form.estimated_minutes, thresholds]);

    const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleClose = () => {
        setForm(emptyForm);
        setErrors({});
        onClose();
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});
        try {
            const { data } = await axios.post<QuickCreatedOperation>(
                route('operations.store'),
                form,
                { headers: { Accept: 'application/json' } },
            );
            setForm(emptyForm);
            onCreated(data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const raw = (error.response.data?.errors ?? {}) as Record<string, string[]>;
                const mapped = Object.fromEntries(Object.entries(raw).map(([field, messages]) => [field, messages[0]]));
                setErrors(mapped);
            } else {
                toast.error('No se pudo crear la operacion.');
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Nueva operacion"
            size="lg"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="operation-quick-create-form" loading={processing}>
                        Guardar
                    </Button>
                </>
            }
        >
            <form id="operation-quick-create-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                    label="Nombre"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    error={errors.name}
                    required
                />
                <Input
                    label="Precio base"
                    type="number"
                    step="0.01"
                    value={form.base_price}
                    onChange={(e) => setField('base_price', e.target.value)}
                    error={errors.base_price}
                    prefix="$"
                    required
                />
                <div className="sm:col-span-2">
                    <Input
                        label="Minutos estandar"
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={form.estimated_minutes}
                        onChange={(e) => setField('estimated_minutes', e.target.value)}
                        error={errors.estimated_minutes}
                        suffix="min"
                        description="Define automaticamente el grado de dificultad de la operacion."
                        required
                    />
                    {previewLevel && (
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            Dificultad calculada: <Badge variant="info">{previewLevel} - {difficultyLabel(previewLevel)}</Badge>
                        </p>
                    )}
                </div>
                <Textarea
                    label="Descripcion"
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    error={errors.description}
                    className="sm:col-span-2"
                    rows={3}
                />
                <div className="sm:col-span-2">
                    <Switch checked={form.is_active} onChange={(v) => setField('is_active', v)} label="Activa" />
                </div>
            </form>
        </Modal>
    );
}

export default OperationQuickCreateModal;
