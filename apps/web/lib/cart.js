const KEY = 'luxe_cart_v1';

function parseCart(raw) {
    try {
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) return [];
        return arr
            .map((x) => ({ productId: Number(x.productId), qty: Math.max(1, Number(x.qty) || 1) }))
            .filter((x) => x.productId);
    } catch {
        return [];
    }
}

export function getCart() {
    if (typeof window === 'undefined') return [];
    return parseCart(localStorage.getItem(KEY));
}

export function setCart(items) {
    if (typeof window === 'undefined') return;
    const clean = [];
    const seen = new Set();
    for (const item of items) {
        const productId = Number(item.productId);
        if (!productId || seen.has(productId)) continue;
        seen.add(productId);
        clean.push({ productId, qty: Math.max(1, Math.min(99, Number(item.qty) || 1)) });
    }
    localStorage.setItem(KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('cart-changed', { detail: clean }));
}

export function getCartCount() {
    return getCart().reduce((sum, i) => sum + i.qty, 0);
}

export function isInCart(productId) {
    return getCart().some((i) => i.productId === Number(productId));
}

export function addToCart(productId, qty = 1) {
    const id = Number(productId);
    const list = getCart();
    const existing = list.find((i) => i.productId === id);
    if (existing) {
        existing.qty = Math.min(99, existing.qty + qty);
        setCart(list);
        return;
    }
    setCart([{ productId: id, qty: Math.max(1, qty) }, ...list]);
}

export function updateCartQty(productId, qty) {
    const id = Number(productId);
    const list = getCart();
    const item = list.find((i) => i.productId === id);
    if (!item) return;
    if (qty <= 0) {
        setCart(list.filter((i) => i.productId !== id));
        return;
    }
    item.qty = Math.min(99, Math.max(1, qty));
    setCart(list);
}

export function removeFromCart(productId) {
    setCart(getCart().filter((i) => i.productId !== Number(productId)));
}

export function clearCart() {
    setCart([]);
}
