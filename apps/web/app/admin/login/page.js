'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [branding, setBranding] = useState({ store_name: 'HEY BLOSSOM', store_logo_url: '' });

    useEffect(() => {
        fetch('/api/store/filters')
            .then((r) => r.json())
            .then((d) => {
                if (d.success && d.branding) setBranding(d.branding);
            })
            .catch(() => {});
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) {
            setError(error.message);
            return;
        }
        const redirectTo = params.get('redirect') || '/admin/dashboard';
        router.replace(redirectTo);
        router.refresh();
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#3B5B9D',
                color: '#fff',
            }}
        >
            <form
                onSubmit={handleSubmit}
                style={{
                    background: '#fff',
                    color: '#0c0c0c',
                    padding: '2.5rem',
                    borderRadius: 16,
                    width: 380,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
                    {branding.store_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.store_logo_url} alt={branding.store_name} style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: 8 }} />
                    ) : (
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#3B5B9D' }}>
                            {branding.store_name}
                        </div>
                    )}
                    <div style={{ fontSize: '0.75rem', letterSpacing: '2px', color: '#6e6e73', textTransform: 'uppercase', marginTop: 4 }}>
                        Admin Panel
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(192,57,43,0.1)', color: '#c0392b', padding: '0.7rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.9rem',
                        marginTop: '1rem',
                        borderRadius: 10,
                        border: 'none',
                        background: '#3B5B9D',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? 'Masuk...' : 'Masuk'}
                </button>
            </form>
        </div>
    );
}

const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, marginTop: 12, color: '#6e6e73' };
const inputStyle = {
    width: '100%',
    padding: '0.7rem 0.9rem',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '0.9rem',
    outline: 'none',
};
