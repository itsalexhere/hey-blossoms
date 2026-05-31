// ============================================================
// Live foreign-exchange → IDR conversion.
// Used by overseas scrapers (ZZER/CNY, Komehyo/JPY, ...) so prices
// are converted with the CURRENT Indonesian exchange rate instead of
// a stale hardcoded number.
//
// Strategy:
//   - fetch live rate from a free, key-less API (open.er-api.com)
//   - cache in-memory for a few hours (one scrape run reuses one rate)
//   - fall back to a sane recent rate if the network/API fails
// ============================================================

// Reasonable recent fallbacks (only used if the live API is unreachable).
const FALLBACK_TO_IDR = {
    IDR: 1,
    CNY: 2270,
    JPY: 105,
    USD: 16300,
    EUR: 17600,
    GBP: 20700,
    SGD: 12100,
    HKD: 2090,
    AUD: 10700,
    KRW: 12,
};

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const _cache = new Map(); // currency -> { rate, at }

/**
 * Get how many IDR equals 1 unit of `currency`, using the current live rate.
 * @param {string} currency e.g. 'CNY', 'JPY', 'USD'
 * @returns {Promise<number>} rate (IDR per 1 unit). Returns 1 for IDR.
 */
export async function getRateToIDR(currency) {
    const cur = String(currency || 'IDR').toUpperCase();
    if (cur === 'IDR') return 1;

    const cached = _cache.get(cur);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.rate;

    try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${cur}`, {
            signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
        });
        if (res.ok) {
            const data = await res.json();
            const rate = data?.rates?.IDR;
            if (rate && rate > 0) {
                _cache.set(cur, { rate, at: Date.now() });
                console.log(`[FX] Live rate: 1 ${cur} = Rp ${Math.round(rate).toLocaleString('id-ID')}`);
                return rate;
            }
        }
    } catch (e) {
        console.warn(`[FX] Live rate fetch failed for ${cur}: ${String(e.message).slice(0, 80)}`);
    }

    const fallback = FALLBACK_TO_IDR[cur] ?? 1;
    console.warn(`[FX] Using fallback rate: 1 ${cur} = Rp ${fallback}`);
    _cache.set(cur, { rate: fallback, at: Date.now() });
    return fallback;
}

/**
 * Convert an amount in `currency` to IDR (rounded), using the current rate.
 * @returns {Promise<number>} amount in IDR
 */
export async function toIDR(amount, currency) {
    const rate = await getRateToIDR(currency);
    return Math.round(Number(amount || 0) * rate);
}
