'use client';

export const AC = {
    bg: '#f4f4f5',
    surface: '#ffffff',
    text: '#0c0c0c',
    muted: '#6e6e73',
    dark: '#1d1d1f',
    blue: '#3B5B9D',
    pink: '#F6BFD1',
    pinkSoft: '#FDE8EF',
    gold: '#F6BFD1',
    border: 'rgba(0,0,0,0.1)',
    danger: '#c0392b',
    success: '#27ae60',
};

export function formatIDR(n) {
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export function formatProductDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function PageTitle({ title, subtitle, right }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', margin: 0, fontWeight: 700 }}>{title}</h1>
                {subtitle && <div style={{ color: AC.muted, fontSize: '0.9rem', marginTop: 4 }}>{subtitle}</div>}
            </div>
            {right}
        </div>
    );
}

export function Card({ children, style }) {
    return (
        <div
            style={{
                background: AC.surface,
                borderRadius: 12,
                border: `1px solid ${AC.border}`,
                padding: '1.25rem',
                ...style,
            }}
        >
            {children}
        </div>
    );
}

export const inputStyle = {
    padding: '0.55rem 0.8rem',
    borderRadius: 8,
    border: `1px solid ${AC.border}`,
    fontSize: '0.9rem',
    outline: 'none',
    background: '#fff',
    fontFamily: 'Outfit, sans-serif',
};

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', style }) {
    const variants = {
        primary: { background: AC.blue, color: '#fff', border: 'none' },
        gold: { background: AC.pink, color: AC.dark, border: 'none' },
        pink: { background: AC.pink, color: AC.dark, border: 'none' },
        outline: { background: 'transparent', color: AC.text, border: `1px solid ${AC.border}` },
        danger: { background: 'transparent', color: AC.danger, border: `1px solid ${AC.danger}` },
    };
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '0.55rem 1rem',
                borderRadius: 8,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                fontFamily: 'Outfit, sans-serif',
                opacity: disabled ? 0.5 : 1,
                ...variants[variant],
                ...style,
            }}
        >
            {children}
        </button>
    );
}

export function StatusBadge({ status }) {
    const ok = status === 'available' || status === 'completed';
    const running = status === 'running';
    const color = running ? AC.blue : ok ? AC.success : AC.danger;
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.75rem',
                fontWeight: 600,
                background: `${color}1a`,
                color,
            }}
        >
            {status}
        </span>
    );
}

export function ModalOverlay({ children, onClose }) {
    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{ zIndex: 6000 }}
        >
            <div
                className="modal-content wishlist-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 520, width: '100%' }}
            >
                <button type="button" className="modal-close-btn" onClick={onClose}>
                    {'\u2715'}
                </button>
                <div className="modal-info-sec" style={{ padding: '2rem', width: '100%' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
