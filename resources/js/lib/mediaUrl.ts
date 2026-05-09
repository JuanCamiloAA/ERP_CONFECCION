/** Resuelve avatar/logo/path local o URL absoluta (p. ej. Firebase) para usar en <img src>. */
export function mediaUrl(stored: string | null | undefined): string | undefined {
    if (stored == null || stored === '') {
        return undefined;
    }
    const s = String(stored).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) {
        return s;
    }
    return `/storage/${s.replace(/^\//, '')}`;
}
