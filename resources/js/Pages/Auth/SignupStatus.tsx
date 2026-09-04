import { Head, Link, router } from '@inertiajs/react';
import { ArrowClockwise, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { PublicButton } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';
import { formatCurrency } from '@/lib/utils';

interface Props {
    reference: string;
    status: 'pendiente' | 'pagado' | 'fallido' | 'expirado';
    transactionStatus: string | null;
    companyName: string;
    planName: string | null;
    amount: number;
    currency: string;
    expired: boolean;
}

/**
 * Vuelta del checkout de Wompi.
 *
 * Solo se ve cuando el pago no quedó confirmado: si está aprobado, el controlador ya
 * inició sesión y mandó al panel. Mientras siga pendiente la página se recarga sola,
 * porque el webhook puede tardar unos segundos en llegar y quien acaba de pagar está
 * mirando esta pantalla.
 */
export default function SignupStatus({
    reference,
    status,
    transactionStatus,
    companyName,
    planName,
    amount,
    currency,
    expired,
}: Props) {
    const pending = status === 'pendiente' && ! expired;

    useEffect(() => {
        if (! pending) return;

        const timer = window.setInterval(() => {
            router.reload({ only: ['status', 'transactionStatus', 'expired'] });
        }, 5000);

        return () => window.clearInterval(timer);
    }, [pending]);

    const view = () => {
        if (status === 'pagado') {
            return {
                icon: <CheckCircle size={26} weight="fill" />,
                title: 'Pago confirmado',
                body: 'Tu empresa quedó activa. Inicia sesión para entrar.',
            };
        }

        if (expired || status === 'expirado') {
            return {
                icon: <Clock size={26} />,
                title: 'El enlace de pago venció',
                body: 'No se cobró nada. Puedes empezar el registro de nuevo con los mismos datos.',
            };
        }

        if (status === 'fallido') {
            return {
                icon: <WarningCircle size={26} />,
                title: 'El pago no se completó',
                body:
                    transactionStatus === 'DECLINED'
                        ? 'El banco rechazó la transacción. No se cobró nada; puedes intentarlo con otro medio de pago.'
                        : 'No se pudo procesar el pago. No se cobró nada; puedes volver a intentarlo.',
            };
        }

        return {
            icon: <ArrowClockwise size={26} />,
            title: 'Estamos confirmando tu pago',
            body: 'Esto suele tardar unos segundos. La página se actualiza sola; no hace falta que hagas nada.',
        };
    };

    const { icon, title, body } = view();

    return (
        <AuthLayout
            title={title}
            description={body}
            heading="Un paso y estás dentro."
            subheading="En cuanto el pago quede aprobado, tu empresa se crea y entras directo al panel."
        >
            <Head title="Estado del pago" />

            <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0" style={{ color: 'var(--pub-accent)' }}>
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-base" style={{ color: 'var(--pub-gray-1)' }}>
                        {title}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--pub-gray-3)' }}>
                        {body}
                    </p>
                </div>
            </div>

            <dl className="mt-6 space-y-2 rounded-xl p-4" style={{ border: '1px solid var(--pub-gray-6)' }}>
                {[
                    ['Empresa', companyName],
                    ['Plan', planName ?? '—'],
                    ['Importe', formatCurrency(amount, currency)],
                    ['Referencia', reference],
                ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
                        <dt style={{ color: 'var(--pub-gray-3)' }}>{label}</dt>
                        <dd className="min-w-0 truncate text-right" style={{ color: 'var(--pub-gray-1)' }}>
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>

            <div className="mt-6 flex gap-3">
                {status === 'pagado' ? (
                    <Link href={route('login')} className="flex-1">
                        <PublicButton type="button">Iniciar sesión</PublicButton>
                    </Link>
                ) : (
                    <Link href={route('register')} className="flex-1">
                        <PublicButton type="button">Volver a intentar</PublicButton>
                    </Link>
                )}
            </div>

            <p className="mt-6 text-sm" style={{ color: 'var(--pub-gray-3)' }}>
                ¿Ya tienes cuenta?{' '}
                <Link href={route('login')} style={{ color: 'var(--pub-accent)' }}>
                    Inicia sesión
                </Link>
            </p>
        </AuthLayout>
    );
}
