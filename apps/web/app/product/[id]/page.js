import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStoreProduct, getStoreBranding } from '@/lib/storefront';
import ProductGallery from '../../components/ProductGallery';

export const dynamic = 'force-dynamic';

function formatIDR(n) {
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export default async function ProductPage({ params }) {
    const { id } = await params;
    const [product, branding] = await Promise.all([getStoreProduct(id), getStoreBranding()]);
    if (!product) notFound();

    const soldOut = product.stock_status !== 'available';

    return (
        <div style={{ minHeight: '100vh', background: '#f7f7f7', color: '#0c0c0c' }}>
            <header
                style={{
                    background: '#1d1d1f',
                    color: '#fff',
                    padding: '1.2rem 2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                }}
            >
                <Link href="/" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {branding.store_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.store_logo_url} alt={branding.store_name} style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700 }}>
                            {branding.store_name}<span style={{ color: '#c5a880' }}>.</span>
                        </span>
                    )}
                </Link>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>/</span>
                <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>
                    Kembali ke katalog
                </Link>
            </header>

            <div
                className="pdp-grid"
                style={{
                    maxWidth: 1100,
                    margin: '0 auto',
                    padding: '2.5rem 2rem',
                }}
            >
                <ProductGallery images={product.images} title={product.title} />

                <div>
                    {product.brand && (
                        <div style={{ textTransform: 'uppercase', letterSpacing: '2px', color: '#c5a880', fontWeight: 600, fontSize: '0.85rem' }}>
                            {product.brand}
                        </div>
                    )}
                    <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', margin: '0.5rem 0 1rem', lineHeight: 1.2 }}>
                        {product.title}
                    </h1>

                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{formatIDR(product.selling_price)}</div>

                    <div
                        style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            borderRadius: 20,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: soldOut ? 'rgba(192,57,43,0.1)' : 'rgba(39,174,96,0.1)',
                            color: soldOut ? '#c0392b' : '#27ae60',
                            marginBottom: '1.5rem',
                        }}
                    >
                        {soldOut ? '● Stok Habis' : `● Tersedia${product.stock_qty ? ` (${product.stock_qty})` : ''}`}
                    </div>

                    {product.category && (
                        <div style={{ marginBottom: '1rem', color: '#6e6e73', fontSize: '0.9rem' }}>
                            Kategori: <strong style={{ color: '#0c0c0c' }}>{product.category}</strong>
                        </div>
                    )}

                    {product.description && (
                        <div style={{ marginTop: '1.5rem', lineHeight: 1.7, color: '#3a3a3c', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                            {product.description}
                        </div>
                    )}

                    <button
                        disabled={soldOut}
                        style={{
                            marginTop: '2rem',
                            width: '100%',
                            padding: '1rem',
                            borderRadius: 10,
                            border: 'none',
                            background: soldOut ? '#ccc' : '#1d1d1f',
                            color: '#fff',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: soldOut ? 'default' : 'pointer',
                        }}
                    >
                        {soldOut ? 'Stok Habis' : 'Hubungi untuk Pemesanan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
