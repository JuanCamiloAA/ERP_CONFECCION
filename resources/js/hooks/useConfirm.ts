import { useCallback, useState } from 'react';

interface ConfirmConfig {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface State extends ConfirmConfig {
    open: boolean;
    resolve?: (value: boolean) => void;
}

export function useConfirm() {
    const [state, setState] = useState<State>({ open: false });

    const confirm = useCallback((config: ConfirmConfig = {}): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            setState({ open: true, ...config, resolve });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        state.resolve?.(true);
        setState((s) => ({ ...s, open: false }));
    }, [state]);

    const handleCancel = useCallback(() => {
        state.resolve?.(false);
        setState((s) => ({ ...s, open: false }));
    }, [state]);

    return { confirm, state, handleConfirm, handleCancel };
}
