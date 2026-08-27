import { Check, Copy } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { SQL_KEYWORDS } from '@/lib/dashboard-widgets';

/** Palabras largas primero: si «GROUP» gana a «GROUP BY», el resaltado parte la frase. */
const PATTERN = new RegExp(
    `(${[...SQL_KEYWORDS]
        .sort((a, b) => b.length - a.length)
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
        .join('|')}|:[a-z_]+)`,
    'gi',
);

interface Props {
    sql: string | null;
    /** En modo SQL avanzado el textarea ya es la fuente; repetirlo sobra. */
    hidden?: boolean;
}

/**
 * El SQL que produce la consulta guiada.
 *
 * Es la respuesta a «¿qué está construyendo esto?»: sin verlo, el modo guiado obliga a
 * confiar en que las casillas hacen lo que dicen. Se pinta desde el mismo constructor que
 * ejecuta la consulta, así que no puede desincronizarse.
 */
export function GeneratedSqlPanel({ sql, hidden = false }: Props) {
    const [copied, setCopied] = useState(false);

    const parts = useMemo(() => (sql ? sql.split(PATTERN) : []), [sql]);

    if (hidden) {
        return null;
    }

    const copy = async () => {
        if (! sql) return;

        try {
            await navigator.clipboard.writeText(sql);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            /* Sin permiso de portapapeles no hay nada que hacer; el <pre> es seleccionable. */
        }
    };

    return (
        <section className="emp-card p-[15px_16px]">
            <header className="flex items-center justify-between gap-2">
                <p className="emp-kicker">SQL generado</p>
                {sql ? (
                    <button type="button" onClick={copy} className="emp-btn emp-btn-sm">
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                ) : null}
            </header>

            {sql ? (
                <>
                    <pre
                        tabIndex={0}
                        className="mt-2.5 overflow-x-auto rounded-[10px] p-2.5 text-[11.5px] leading-relaxed"
                        style={{
                            backgroundColor: 'var(--emp-field)',
                            border: '1px solid var(--emp-border)',
                            color: 'var(--emp-text)',
                            fontFamily: 'ui-monospace, monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {parts.map((part, index) => {
                            if (part === undefined || part === '') return null;

                            if (part.startsWith(':')) {
                                return (
                                    <span key={index} style={{ color: 'var(--emp-accent-line)' }}>
                                        {part}
                                    </span>
                                );
                            }

                            const isKeyword = index % 2 === 1;

                            return isKeyword ? (
                                <span key={index} style={{ color: 'var(--emp-accent-on)' }}>
                                    {part}
                                </span>
                            ) : (
                                <span key={index}>{part}</span>
                            );
                        })}
                    </pre>

                    <p className="emp-help">
                        Solo lectura. Las variables en acento se reemplazan al pintar el dashboard de cada usuario.
                    </p>
                </>
            ) : (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    Completa la consulta y pulsa «Probar consulta» para ver el SQL que se va a ejecutar.
                </p>
            )}
        </section>
    );
}

export default GeneratedSqlPanel;
