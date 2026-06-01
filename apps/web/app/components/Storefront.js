'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getWishlist, toggleWishlist } from '@/lib/wishlist';
import { getCart, getCartCount, addToCart, updateCartQty, removeFromCart, clearCart } from '@/lib/cart';
import ProductGallery from './ProductGallery';

const PAGE = 24;

const SORT_MAP = {
    newest: 'newest',
    price_asc: 'cheapest',
    price_desc: 'expensive',
    title_asc: 'title_asc',
};

export default function Storefront() {
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);

    const [categoryGroups, setCategoryGroups] = useState([]);
    const [categories, setCategories] = useState([]);
    const [priceBuckets, setPriceBuckets] = useState([]);
    const [brands, setBrands] = useState([]);
    const [branding, setBranding] = useState({ store_name: 'LUXE', store_logo_url: '' });
    const [sourceLabels, setSourceLabels] = useState({});

    const [storeSearch, setStoreSearch] = useState('');
    const [storeGender, setStoreGender] = useState('');
    const [storeBrandFilter, setStoreBrandFilter] = useState('');
    const [storeCategoryFilter, setStoreCategoryFilter] = useState('');
    const [storePriceBucket, setStorePriceBucket] = useState('');
    const [storeMinPrice, setStoreMinPrice] = useState('');
    const [storeMaxPrice, setStoreMaxPrice] = useState('');
    const [showPriceFilter, setShowPriceFilter] = useState(false);
    const [priceDraftMin, setPriceDraftMin] = useState('');
    const [priceDraftMax, setPriceDraftMax] = useState('');
    const [priceFilterError, setPriceFilterError] = useState('');
    const [storeSort, setStoreSort] = useState('price_asc');

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productDetail, setProductDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showWishlist, setShowWishlist] = useState(false);
    const [wishlistProducts, setWishlistProducts] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [cartStep, setCartStep] = useState('cart');
    const [cartItems, setCartItems] = useState([]);
    const [cartProducts, setCartProducts] = useState([]);
    const [cartCount, setCartCount] = useState(0);
    const [wishlistIds, setWishlistIds] = useState([]);

    const [checkoutForm, setCheckoutForm] = useState({ customer_name: '', phone: '', address: '', notes: '' });
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [orderResult, setOrderResult] = useState(null);

    const debounceRef = useRef(null);

    function syncCartState() {
        setCartItems(getCart());
        setCartCount(getCartCount());
        setWishlistIds(getWishlist());
    }

    useEffect(() => {
        fetch('/api/store/filters')
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setCategoryGroups(d.categoryGroups || []);
                    setCategories(
                        (d.categoryGroups || []).flatMap((g) =>
                            (g.options || []).map((o) => ({ id: o.slug, name: o.name, slug: o.slug }))
                        )
                    );
                    setPriceBuckets(d.priceBuckets || []);
                    setBrands(d.brands || []);
                    if (d.branding) setBranding(d.branding);
                    if (d.sourceLabels) setSourceLabels(d.sourceLabels);
                }
            })
            .catch(() => {});
        syncCartState();
    }, []);

    useEffect(() => {
        const onCart = () => syncCartState();
        const onWish = () => setWishlistIds(getWishlist());
        window.addEventListener('cart-changed', onCart);
        window.addEventListener('wishlist-changed', onWish);
        return () => {
            window.removeEventListener('cart-changed', onCart);
            window.removeEventListener('wishlist-changed', onWish);
        };
    }, []);

    useEffect(() => {
        if (!showCart || cartItems.length === 0) {
            setCartProducts([]);
            return;
        }
        const ids = cartItems.map((i) => i.productId).join(',');
        fetch(`/api/store/products?ids=${ids}&limit=200`)
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setCartProducts(d.products || []);
            })
            .catch(() => {});
    }, [showCart, cartItems]);

    useEffect(() => {
        if (!showWishlist || wishlistIds.length === 0) {
            setWishlistProducts([]);
            return;
        }
        fetch(`/api/store/products?ids=${wishlistIds.join(',')}&limit=200`)
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setWishlistProducts(d.products || []);
            })
            .catch(() => {});
    }, [showWishlist, wishlistIds]);

    useEffect(() => {
        if (!selectedProduct?.id) {
            setProductDetail(null);
            setDetailLoading(false);
            return;
        }
        setDetailLoading(true);
        setProductDetail(null);
        fetch(`/api/store/products/${selectedProduct.id}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setProductDetail(d.product);
            })
            .catch(() => {})
            .finally(() => setDetailLoading(false));
    }, [selectedProduct?.id]);

    const onFilter = (setter) => (value) => {
        setPage(0);
        setter(value);
    };

    function handlePriceBucketChange(bucketId) {
        if (bucketId === 'custom') {
            setPriceDraftMin(storeMinPrice);
            setPriceDraftMax(storeMaxPrice);
            setPriceFilterError('');
            setShowPriceFilter(true);
            return;
        }

        setPage(0);
        setStorePriceBucket(bucketId);
        const b = priceBuckets.find((x) => x.id === bucketId);
        if (b) {
            setStoreMinPrice(b.min != null ? String(b.min) : '');
            setStoreMaxPrice(b.max != null ? String(b.max) : '');
        } else {
            setStoreMinPrice('');
            setStoreMaxPrice('');
        }
    }

    function applyCustomPriceFilter() {
        const min = priceDraftMin.replace(/\D/g, '');
        const max = priceDraftMax.replace(/\D/g, '');
        if (!min && !max) {
            setPriceFilterError('Isi minimal harga min atau max');
            return;
        }
        if (min && max && Number(min) > Number(max)) {
            setPriceFilterError('Harga min tidak boleh lebih besar dari max');
            return;
        }
        setPage(0);
        setStorePriceBucket('custom');
        setStoreMinPrice(min);
        setStoreMaxPrice(max);
        setPriceFilterError('');
        setShowPriceFilter(false);
    }

    function clearCustomPriceFilter() {
        setPage(0);
        setStorePriceBucket('');
        setStoreMinPrice('');
        setStoreMaxPrice('');
        setPriceDraftMin('');
        setPriceDraftMax('');
        setPriceFilterError('');
        setShowPriceFilter(false);
    }

    const priceSelectValue = storePriceBucket === 'custom' ? 'custom' : storePriceBucket;

    const buildParams = useCallback(() => {
        const p = new URLSearchParams();
        if (storeSearch) p.set('search', storeSearch);
        if (storeGender) p.set('gender', storeGender);
        if (storeBrandFilter) p.set('brand', storeBrandFilter);
        if (storeCategoryFilter) p.set('category', storeCategoryFilter);
        if (storeMinPrice) p.set('minPrice', storeMinPrice);
        if (storeMaxPrice) p.set('maxPrice', storeMaxPrice);
        if (!storeMinPrice && !storeMaxPrice && storePriceBucket && storePriceBucket !== 'custom') {
            p.set('priceBucket', storePriceBucket);
        }
        p.set('sort', SORT_MAP[storeSort] || 'newest');
        p.set('limit', String(PAGE));
        p.set('offset', String(page * PAGE));
        return p.toString();
    }, [storeSearch, storeGender, storeBrandFilter, storeCategoryFilter, storePriceBucket, storeMinPrice, storeMaxPrice, storeSort, page]);

    const load = useCallback(() => {
        setLoading(true);
        fetch('/api/store/products?' + buildParams())
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setProducts(d.products || []);
                    setTotal(d.total || 0);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [buildParams]);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(load, 250);
        return () => clearTimeout(debounceRef.current);
    }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE));

    const cartLines = useMemo(() => {
        const qtyMap = new Map(cartItems.map((i) => [i.productId, i.qty]));
        return cartProducts
            .filter((p) => qtyMap.has(p.id))
            .map((p) => ({
                ...p,
                qty: qtyMap.get(p.id) || 1,
                lineTotal: (p.selling_price || 0) * (qtyMap.get(p.id) || 1),
            }));
    }, [cartItems, cartProducts]);

    const cartGrandTotal = useMemo(() => cartLines.reduce((s, l) => s + l.lineTotal, 0), [cartLines]);

    const goToPage = (p) => {
        setPage(p);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const formatPrice = (priceIdr) => {
        if (!priceIdr) return 'N/A';
        return `Rp ${Math.round(priceIdr).toLocaleString('id-ID')}`;
    };

    function handleHeartToggle(e, productId) {
        e.stopPropagation();
        toggleWishlist(productId);
    }

    function addProductToCart(e, productId) {
        e?.stopPropagation();
        addToCart(productId, 1);
    }

    function openCart(step = 'cart') {
        setCartStep(step);
        setCheckoutError('');
        setOrderResult(null);
        setShowCart(true);
    }

    function startCheckoutFromProduct(product) {
        if (product.stock_status !== 'available') return;
        addToCart(product.id, 1);
        setSelectedProduct(null);
        openCart('checkout');
    }

    async function submitCheckout(e) {
        e.preventDefault();
        setCheckoutLoading(true);
        setCheckoutError('');
        try {
            const items = cartItems.map((i) => ({ product_id: i.productId, qty: i.qty }));
            const res = await fetch('/api/store/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...checkoutForm, items }),
            });
            const d = await res.json();
            if (d.success) {
                clearCart();
                setOrderResult(d);
                setCartStep('success');
                setCheckoutForm({ customer_name: '', phone: '', address: '', notes: '' });
            } else {
                setCheckoutError(d.error || 'Gagal membuat pesanan');
            }
        } catch (err) {
            setCheckoutError(err.message);
        } finally {
            setCheckoutLoading(false);
        }
    }

    return (
        <main className="dashboard-main-app">
            <div className="bg-animated"></div>

            <nav className="minimal-nav">
                <div className="logo">
                    {branding.store_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.store_logo_url} alt={branding.store_name} style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <>
                            {branding.store_name}
                            <span>.</span>
                        </>
                    )}
                </div>
                <div className="nav-links">
                    <a href="#" className="active nav-link-desktop" onClick={(e) => e.preventDefault()}>
                        Boutique Storefront
                    </a>
                    <a
                        href="#"
                        className="nav-action"
                        onClick={(e) => {
                            e.preventDefault();
                            setShowWishlist(true);
                        }}
                    >
                        <span className="nav-action-icon" aria-hidden="true">{'\u2661'}</span>
                        <span className="nav-action-text">Wishlist</span>
                        <span className="nav-action-count">({wishlistIds.length})</span>
                    </a>
                    <a
                        href="#"
                        className="nav-action"
                        onClick={(e) => {
                            e.preventDefault();
                            openCart('cart');
                        }}
                    >
                        <span className="nav-action-icon" aria-hidden="true">{'\u{1F6D2}'}</span>
                        <span className="nav-action-text">Keranjang</span>
                        <span className="nav-action-count">({cartCount})</span>
                    </a>
                </div>
            </nav>

            <div className="storefront-body">
                <section className="catalog-section catalog-section--no-hero">
                    <div className="storefront-filters">
                        <div className="filters-left">
                            <input
                                type="text"
                                className="premium-input"
                                placeholder="Search catalog..."
                                value={storeSearch}
                                onChange={(e) => onFilter(setStoreSearch)(e.target.value)}
                                style={{ minWidth: '220px' }}
                            />

                            <select className="premium-select" value={storeGender} onChange={(e) => onFilter(setStoreGender)(e.target.value)}>
                                <option value="">All Gender</option>
                                <option value="men">Men</option>
                                <option value="women">Women</option>
                            </select>

                            <select className="premium-select" value={storeCategoryFilter} onChange={(e) => onFilter(setStoreCategoryFilter)(e.target.value)}>
                                <option value="">All Categories</option>
                                {categoryGroups.map((g) => (
                                    <optgroup key={g.label} label={g.label}>
                                        {g.options.map((o) => (
                                            <option key={o.slug} value={o.slug}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                                {categoryGroups.length === 0 &&
                                    categories.map((c) => (
                                        <option key={c.id || c.slug} value={c.slug}>
                                            {c.name}
                                        </option>
                                    ))}
                            </select>

                            <select className="premium-select" value={storeBrandFilter} onChange={(e) => onFilter(setStoreBrandFilter)(e.target.value)}>
                                <option value="">All Brands</option>
                                {brands.map((b) => (
                                    <option key={b.id} value={b.name}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>

                            <select className="premium-select" value={priceSelectValue} onChange={(e) => handlePriceBucketChange(e.target.value)}>
                                <option value="">All Prices</option>
                                {priceBuckets.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.label}
                                    </option>
                                ))}
                                <option value="custom">
                                    {storePriceBucket === 'custom' && (storeMinPrice || storeMaxPrice)
                                        ? `Custom: ${storeMinPrice ? formatPrice(Number(storeMinPrice)) : '—'} – ${storeMaxPrice ? formatPrice(Number(storeMaxPrice)) : '—'}`
                                        : 'Custom...'}
                                </option>
                            </select>

                            <select className="premium-select" value={storeSort} onChange={(e) => onFilter(setStoreSort)(e.target.value)}>
                                <option value="newest">Latest Arrivals First</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="title_asc">A – Z</option>
                            </select>
                        </div>
                    </div>

                    <div className="catalog-header">
                        <h2>Featured Collection</h2>
                        <span className="item-count">{total.toLocaleString('id-ID')} Items Listed</span>
                    </div>

                    {loading && (
                        <div className="loader">
                            <div className="spinner"></div>
                            <p style={{ fontWeight: '500', color: 'var(--text-muted)' }}>Fetching luxury boutique inventory...</p>
                        </div>
                    )}

                    {!loading && products.length === 0 && (
                        <div className="empty-state">
                            <p>No items matched your filters.</p>
                            <span>Try adjusting or clearing your search criteria to browse the collection.</span>
                        </div>
                    )}

                    {!loading && products.length > 0 && (
                        <>
                            <div className="minimal-grid">
                                {products.map((p) => (
                                    <div key={p.id} className="minimal-card" onClick={() => setSelectedProduct(p)}>
                                        <div className="img-container">
                                            {p.source && (
                                                <span className={`card-site-tag site-badge ${p.source.toLowerCase()}`}>{sourceLabels[p.source] || p.source}</span>
                                            )}
                                            <button
                                                type="button"
                                                className={`wishlist-heart${wishlistIds.includes(p.id) ? ' active' : ''}`}
                                                onClick={(e) => handleHeartToggle(e, p.id)}
                                                aria-label={wishlistIds.includes(p.id) ? 'Hapus dari wishlist' : 'Simpan ke wishlist'}
                                            >
                                                {wishlistIds.includes(p.id) ? '\u2665' : '\u2661'}
                                            </button>
                                            <img
                                                src={p.image_url || 'https://via.placeholder.com/350x350/f5f5f5/cccccc?text=No+Image'}
                                                alt={p.title}
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/350x350/f5f5f5/cccccc?text=No+Image';
                                                }}
                                            />
                                            <button className="hover-buy-btn">Lihat Produk</button>
                                        </div>
                                        <div className="product-info">
                                            <div className="product-brand">{p.brand || 'Boutique'}</div>
                                            <h3>{p.title}</h3>
                                            <div className="card-price-row">
                                                <span className="final-price">{formatPrice(p.selling_price)}</span>
                                                <span className={`card-stock-indicator ${p.stock_status === 'available' ? 'available' : 'sold_out'}`}>
                                                    {'\u25CF'} {p.stock_status === 'available' ? 'Available' : 'Sold Out'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={goToPage} />}
                        </>
                    )}
                </section>

                {showPriceFilter && (
                    <div className="modal-overlay" onClick={() => setShowPriceFilter(false)}>
                        <div className="modal-content price-filter-modal" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowPriceFilter(false)}>
                                {'\u2715'}
                            </button>
                            <div className="modal-info-sec" style={{ padding: '2rem', width: '100%' }}>
                                <h2 className="modal-title" style={{ marginBottom: '0.5rem' }}>Filter Harga Custom</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                    Masukkan rentang harga jual (IDR). Kosongkan salah satu sisi jika tanpa batas.
                                </p>
                                {priceFilterError && <div className="checkout-error">{priceFilterError}</div>}
                                <label className="checkout-label">Harga Min (IDR)</label>
                                <input
                                    className="premium-input checkout-input"
                                    placeholder="Contoh: 2.000.000"
                                    value={priceDraftMin ? Number(priceDraftMin).toLocaleString('id-ID') : ''}
                                    onChange={(e) => setPriceDraftMin(e.target.value.replace(/\D/g, ''))}
                                />
                                <label className="checkout-label">Harga Max (IDR)</label>
                                <input
                                    className="premium-input checkout-input"
                                    placeholder="Contoh: 20.000.000"
                                    value={priceDraftMax ? Number(priceDraftMax).toLocaleString('id-ID') : ''}
                                    onChange={(e) => setPriceDraftMax(e.target.value.replace(/\D/g, ''))}
                                />
                                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                    {storePriceBucket === 'custom' && (
                                        <button type="button" className="btn btn-secondary" onClick={clearCustomPriceFilter}>
                                            Reset
                                        </button>
                                    )}
                                    <button type="button" className="btn btn-secondary" style={{ flex: storePriceBucket === 'custom' ? undefined : 1 }} onClick={() => setShowPriceFilter(false)}>
                                        Batal
                                    </button>
                                    <button type="button" className="btn btn-primary-luxe" style={{ flex: 1 }} onClick={applyCustomPriceFilter}>
                                        Terapkan
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showWishlist && (
                    <div className="modal-overlay" onClick={() => setShowWishlist(false)}>
                        <div className="modal-content wishlist-modal" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowWishlist(false)}>
                                {'\u2715'}
                            </button>
                            <div className="modal-info-sec" style={{ padding: '2.5rem', width: '100%' }}>
                                <h2 className="modal-title" style={{ marginBottom: '0.5rem' }}>Wishlist Saya</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                    Simpan produk favorit di sini. Untuk pesan, gunakan &quot;Tambah ke Keranjang&quot;.
                                </p>
                                {wishlistIds.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)' }}>Belum ada item. Tap icon hati di produk untuk menyimpan.</p>
                                )}
                                {wishlistIds.length > 0 && wishlistProducts.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)' }}>Memuat wishlist...</p>
                                )}
                                <div className="wishlist-list">
                                    {wishlistProducts.map((p) => (
                                        <div key={p.id} className="wishlist-row">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={p.image_url || 'https://via.placeholder.com/80'}
                                                alt=""
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setShowWishlist(false);
                                                    setSelectedProduct(p);
                                                }}
                                            />
                                            <div
                                                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                                onClick={() => {
                                                    setShowWishlist(false);
                                                    setSelectedProduct(p);
                                                }}
                                            >
                                                {p.source && (
                                                    <span className={`card-site-tag site-badge ${p.source.toLowerCase()}`} style={{ position: 'static', marginBottom: 4, display: 'inline-block', fontSize: '0.65rem' }}>
                                                        {sourceLabels[p.source] || p.source}
                                                    </span>
                                                )}
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.brand}</div>
                                                <div style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatPrice(p.selling_price)}</div>
                                            </div>
                                            <div className="wishlist-row-actions">
                                                {p.stock_status === 'available' && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', whiteSpace: 'nowrap' }}
                                                        onClick={(e) => addProductToCart(e, p.id)}
                                                    >
                                                        Tambah ke Keranjang
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="wishlist-heart wishlist-heart-inline active"
                                                    onClick={(e) => handleHeartToggle(e, p.id)}
                                                    aria-label="Hapus dari wishlist"
                                                >
                                                    {'\u2665'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showCart && (
                    <div className="modal-overlay" onClick={() => setShowCart(false)}>
                        <div className="modal-content wishlist-modal cart-modal" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowCart(false)}>
                                {'\u2715'}
                            </button>
                            <div className="modal-info-sec" style={{ padding: '2.5rem', width: '100%' }}>
                                {cartStep === 'success' && orderResult && (
                                    <div className="checkout-success">
                                        <h2 className="modal-title">Pesanan Berhasil!</h2>
                                        <p>No. pesanan: <strong>{orderResult.order_number}</strong></p>
                                        <p>Total: <strong>{formatPrice(orderResult.total_amount)}</strong></p>
                                        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Tim kami akan menghubungi Anda segera.</p>
                                        <button className="btn btn-primary-luxe" style={{ marginTop: 20, width: '100%' }} onClick={() => setShowCart(false)}>
                                            Tutup
                                        </button>
                                    </div>
                                )}

                                {cartStep === 'checkout' && (
                                    <form onSubmit={submitCheckout}>
                                        <h2 className="modal-title" style={{ marginBottom: '1rem' }}>Checkout</h2>
                                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                                            Total: <strong>{formatPrice(cartGrandTotal)}</strong> ({cartCount} item)
                                        </p>
                                        {checkoutError && <div className="checkout-error">{checkoutError}</div>}
                                        <label className="checkout-label">Nama Lengkap *</label>
                                        <input className="premium-input checkout-input" required value={checkoutForm.customer_name} onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_name: e.target.value })} />
                                        <label className="checkout-label">No. HP *</label>
                                        <input className="premium-input checkout-input" required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                                        <label className="checkout-label">Alamat Lengkap *</label>
                                        <textarea className="premium-input checkout-input" required rows={3} value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} />
                                        <label className="checkout-label">Catatan (opsional)</label>
                                        <input className="premium-input checkout-input" value={checkoutForm.notes} onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })} />
                                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                            <button type="button" className="btn btn-secondary" onClick={() => setCartStep('cart')}>Kembali</button>
                                            <button type="submit" className="btn btn-primary-luxe" style={{ flex: 1 }} disabled={checkoutLoading}>
                                                {checkoutLoading ? 'Memproses...' : 'Kirim Pesanan'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {cartStep === 'cart' && (
                                    <>
                                        <h2 className="modal-title" style={{ marginBottom: '1.5rem' }}>Keranjang</h2>
                                        {cartItems.length === 0 && (
                                            <p style={{ color: 'var(--text-muted)' }}>Keranjang kosong. Gunakan &quot;Pesan Sekarang&quot; atau &quot;Tambah ke Keranjang&quot; di detail produk.</p>
                                        )}
                                        {cartItems.length > 0 && cartLines.length === 0 && (
                                            <p style={{ color: 'var(--text-muted)' }}>Memuat keranjang...</p>
                                        )}
                                        <div className="wishlist-list cart-list">
                                            {cartLines.map((p) => (
                                                <div key={p.id} className="wishlist-row cart-row">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={p.image_url || 'https://via.placeholder.com/80'} alt="" />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {p.source && (
                                                            <span className={`card-site-tag site-badge ${p.source.toLowerCase()}`} style={{ position: 'static', marginBottom: 4, display: 'inline-block', fontSize: '0.65rem' }}>
                                                                {sourceLabels[p.source] || p.source}
                                                            </span>
                                                        )}
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.brand}</div>
                                                        <div style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatPrice(p.selling_price)}</div>
                                                        <div className="cart-qty-row">
                                                            <button type="button" className="qty-btn" onClick={() => updateCartQty(p.id, p.qty - 1)}>−</button>
                                                            <span>{p.qty}</span>
                                                            <button type="button" className="qty-btn" onClick={() => updateCartQty(p.id, p.qty + 1)}>+</button>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatPrice(p.lineTotal)}</div>
                                                        <button type="button" className="cart-remove-btn" onClick={() => removeFromCart(p.id)}>Hapus</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {cartLines.length > 0 && (
                                            <div className="cart-footer">
                                                <div className="cart-total-row">
                                                    <span>Total ({cartCount} item)</span>
                                                    <strong>{formatPrice(cartGrandTotal)}</strong>
                                                </div>
                                                <button className="btn btn-primary-luxe" style={{ width: '100%', marginTop: 16 }} onClick={() => setCartStep('checkout')}>
                                                    Checkout
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedProduct && (
                    <div className="modal-overlay" onClick={() => { setSelectedProduct(null); setProductDetail(null); }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => { setSelectedProduct(null); setProductDetail(null); }}>
                                {'\u2715'}
                            </button>

                            <div className="modal-img-sec">
                                {selectedProduct.source && (
                                    <span
                                        className={`card-site-tag site-badge ${selectedProduct.source.toLowerCase()}`}
                                        style={{ top: '25px', left: '25px', fontSize: '0.8rem', padding: '0.4rem 0.8rem', zIndex: 2 }}
                                    >
                                        {sourceLabels[selectedProduct.source] || selectedProduct.source}
                                    </span>
                                )}
                                {detailLoading ? (
                                    <div className="modal-gallery-loading">Memuat foto...</div>
                                ) : (
                                    <ProductGallery
                                        images={
                                            productDetail?.images?.length
                                                ? productDetail.images
                                                : (selectedProduct.images?.length
                                                    ? selectedProduct.images
                                                    : (selectedProduct.image_url ? [selectedProduct.image_url] : []))
                                        }
                                        title={selectedProduct.title}
                                    />
                                )}
                            </div>

                            <div className="modal-info-sec">
                                <div>
                                    <div className="modal-brand">{selectedProduct.brand || 'Exquisite luxury'}</div>
                                    <h2 className="modal-title">{selectedProduct.title}</h2>

                                    <div className="modal-meta-grid">
                                        <div className="meta-item">
                                            <label>Brand</label>
                                            <span>{selectedProduct.brand || '—'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <label>Availability</label>
                                            <span style={{ color: selectedProduct.stock_status === 'available' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                                                {selectedProduct.stock_status === 'available' ? 'Available in Stock' : 'Sold Out'}
                                            </span>
                                        </div>
                                        <div className="meta-item">
                                            <label>Category</label>
                                            <span>{selectedProduct.category || 'Handbags'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <label>Updated</label>
                                            <span>{selectedProduct.scraped_at ? new Date(selectedProduct.scraped_at).toLocaleDateString('id-ID') : '—'}</span>
                                        </div>
                                    </div>

                                    {(productDetail?.description || selectedProduct.description) && (
                                        <div className="modal-description">
                                            <div className="modal-description-label">Deskripsi</div>
                                            <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.65, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                                                {productDetail?.description || selectedProduct.description}
                                            </p>
                                        </div>
                                    )}

                                    <div className="modal-price-box">
                                        <div className="modal-price-label">Catalog Price</div>
                                        <div className="modal-price-value">{formatPrice(selectedProduct.selling_price)}</div>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button
                                        className="btn btn-primary-luxe"
                                        style={{ flex: 1 }}
                                        disabled={selectedProduct.stock_status !== 'available'}
                                        onClick={() => startCheckoutFromProduct(selectedProduct)}
                                    >
                                        {selectedProduct.stock_status === 'available' ? 'Pesan Sekarang' : 'Stok Habis'}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ flex: 1 }}
                                        disabled={selectedProduct.stock_status !== 'available'}
                                        onClick={() => addProductToCart(null, selectedProduct.id)}
                                    >
                                        Tambah ke Keranjang
                                    </button>
                                    <button
                                        type="button"
                                        className={`wishlist-heart wishlist-heart-inline modal-actions-heart${wishlistIds.includes(selectedProduct.id) ? ' active' : ''}`}
                                        onClick={(e) => handleHeartToggle(e, selectedProduct.id)}
                                        aria-label={wishlistIds.includes(selectedProduct.id) ? 'Hapus dari wishlist' : 'Simpan ke wishlist'}
                                    >
                                        {wishlistIds.includes(selectedProduct.id) ? '\u2665' : '\u2661'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

function buildPageList(page, totalPages) {
    const cur = page + 1;
    const pages = new Set([1, totalPages, cur, cur - 1, cur + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
        if (prev && p - prev > 1) out.push('…');
        out.push(p);
        prev = p;
    }
    return out;
}

function Pagination({ page, totalPages, onChange }) {
    const list = buildPageList(page, totalPages);
    return (
        <div className="store-pagination">
            <button className="page-btn" onClick={() => onChange(page - 1)} disabled={page === 0}>
                ‹ Prev
            </button>
            {list.map((p, i) =>
                p === '…' ? (
                    <span key={`e${i}`} className="page-ellipsis">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        className={`page-btn ${p - 1 === page ? 'active' : ''}`}
                        onClick={() => onChange(p - 1)}
                    >
                        {p}
                    </button>
                )
            )}
            <button className="page-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}>
                Next ›
            </button>
        </div>
    );
}
