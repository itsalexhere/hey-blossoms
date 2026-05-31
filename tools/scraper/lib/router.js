import { BanananinaScraper } from '../scrapers/banananina.js';
import { ZetabagsScraper } from '../scrapers/zetabags.js';
import { HuntstreetScraper } from '../scrapers/huntstreet.js';
import { YoogisclosetScraper } from '../scrapers/yoogiscloset.js';

const SCRAPER_MAP = {
    'banananina.co.id': BanananinaScraper,
    'banananina': BanananinaScraper,
    'zetabags.com': ZetabagsScraper,
    'zetabags': ZetabagsScraper,
    'huntstreet.com': HuntstreetScraper,
    'huntstreet': HuntstreetScraper,
    'yoogiscloset.com': YoogisclosetScraper,
    'yoogiscloset': YoogisclosetScraper,
};

export function getScraperForUrl(url, options = {}) {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');

    for (const [domain, ScraperClass] of Object.entries(SCRAPER_MAP)) {
        if (hostname.includes(domain)) {
            return new ScraperClass(options);
        }
    }

    throw new Error(`UNSUPPORTED_SITE: Domain "${hostname}" is not supported. Supported: ${getSupportedDomains().join(', ')}`);
}

export function isSupportedUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
        return Object.keys(SCRAPER_MAP).some(domain => hostname.includes(domain));
    } catch {
        return false;
    }
}

export function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

export function getSupportedDomains() {
    return ['banananina.co.id', 'zetabags.com', 'huntstreet.com', 'yoogiscloset.com'];
}

export function getSourceInfoFromUrl(url) {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');

    const sourceMap = {
        'banananina.co.id': { name: 'Banananina', baseUrl: 'https://www.banananina.co.id', platform: 'woocommerce' },
        'zetabags.com': { name: 'ZetaBags', baseUrl: 'https://zetabags.com', platform: 'shopify' },
        'huntstreet.com': { name: 'HuntStreet', baseUrl: 'https://www.huntstreet.com', platform: 'custom' },
        'yoogiscloset.com': { name: "Yoogi's Closet", baseUrl: 'https://www.yoogiscloset.com', platform: 'magento' },
    };

    for (const [domain, info] of Object.entries(sourceMap)) {
        if (hostname.includes(domain)) return info;
    }

    return null;
}

export async function scrapeCategory(url, headless = true) {
    const scraper = getScraperForUrl(url, { headless });
    return scraper.scrape(url);
}
