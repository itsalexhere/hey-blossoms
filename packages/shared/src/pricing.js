/**
 * Selling price rules:
 * - markup_addon_idr set (not null) → original + addon (ignore global %)
 * - otherwise → round(original × (1 + markupPercent/100))
 */
export function computeSellingPrice(originalPrice, markupPercent, markupAddonIdr = null) {
    const base = Number(originalPrice || 0);
    if (markupAddonIdr != null && markupAddonIdr !== '') {
        return Math.round(base + Number(markupAddonIdr || 0));
    }
    return Math.round(base * (1 + Number(markupPercent || 0) / 100));
}

export function applyMarkup(originalPrice, markupPercent) {
    return computeSellingPrice(originalPrice, markupPercent, null);
}

export function hasManualMarkup(markupAddonIdr) {
    return markupAddonIdr != null && markupAddonIdr !== '';
}
