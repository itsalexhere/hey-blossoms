const KEY = 'luxe_wishlist_v1';

export function getWishlist() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((id) => Number.isFinite(Number(id))).map(Number) : [];
    } catch {
        return [];
    }
}

export function setWishlist(ids) {
    if (typeof window === 'undefined') return;
    const clean = [...new Set(ids.map(Number).filter(Boolean))];
    localStorage.setItem(KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('wishlist-changed', { detail: clean }));
}

export function isInWishlist(productId) {
    return getWishlist().includes(Number(productId));
}

export function toggleWishlist(productId) {
    const id = Number(productId);
    const list = getWishlist();
    if (list.includes(id)) {
        setWishlist(list.filter((x) => x !== id));
        return false;
    }
    setWishlist([id, ...list]);
    return true;
}
