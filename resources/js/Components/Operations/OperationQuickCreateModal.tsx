import axios from 'axios';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';

export interface QuickCreatedOperation {
    id: number;
    name: string;
    base_price: string | number;
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
    is_active: true,
};

export function OperationQuickCreateModal({ open, onClose, onCreated }: OperationQuickCreateModalProps) {
    const [form, setForm] = useState(emptyForm);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

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
