#!/usr/bin/env node
/**
 * Local scrape CLI — runs Puppeteer on your laptop and writes to Supabase.
 *
 * Usage:
 *   node bin/scrape.mjs --url "https://..." [--headless] [--maxPages 5] [--gender men] [--brand "Louis Vuitton"] [--partial]
 *   npm run scrape -- --url "https://..." --maxPages 1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getScraperForUrl,
    isValidUrl,
    isSupportedUrl,
    getSourceInfoFromUrl,
    getSupportedDomains,
} from '../lib/router.js';
import { isVipSource } from '@luxe/shared/vip-config';
import { toIDR } from '@luxe/shared/currency';
import {
    getOrCreateSource,
    createSession,
    updateSession,
    insertProducts,
    markMissingSoldOut,
    dedupeActiveProducts,
    logError,
} from '@luxe/shared/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');

function loadEnv() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('Missing .env.local at js_scraper/.env.local');
        process.exit(1);
    }
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

function parseArgs(argv) {
    const args = { headless: true, partialScrape: false, skipDetail: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--url') args.url = argv[++i];
        else if (a === '--headless') args.headless = argv[++i] !== 'false';
        else if (a === '--maxPages') args.maxPages = Number(argv[++i]);
        else if (a === '--gender') args.gender = argv[++i];
        else if (a === '--brand') args.brand = argv[++i];
        else if (a === '--categoryHint') args.categoryHint = argv[++i];
        else if (a === '--partial') args.partialScrape = true;
        else if (a === '--skipDetail') args.skipDetail = true;
        else if (a === '--help' || a === '-h') args.help = true;
    }
    return args;
}

function printHelp() {
    console.log(`luxe-scrape — VIP catalog scraper (local only)

Usage:
  npm run scrape -- --url "https://www.huntstreet.com/..." [options]

Options:
  --url           Target listing URL (required)
  --headless      true|false (default: true)
  --maxPages      Max pages to scrape
  --gender        men / women (HuntStreet, ZetaBags)
  --brand         Filter brand e.g. "Louis Vuitton"
  --categoryHint  Category hint for taxonomy
  --partial       Skip global sold-out sweep
  --skipDetail    Skip PDP enrichment (gallery + description)
  --help          Show this help

Supported: ${getSupportedDomains().join(', ')}
`);
}

loadEnv();

const args = parseArgs(process.argv.slice(2));
if (args.help) {
    printHelp();
    process.exit(0);
}

if (!args.url) {
    printHelp();
    process.exit(1);
}

const startTime = Date.now();
let sessionId = null;
let sourceId = null;

async function main() {
    if (!isValidUrl(args.url)) {
        console.error(`Invalid URL: ${args.url}`);
        process.exit(1);
    }

    if (!isSupportedUrl(args.url)) {
        console.error(`Unsupported site. Supported: ${getSupportedDomains().join(', ')}`);
        process.exit(1);
    }

    const sourceInfo = getSourceInfoFromUrl(args.url);
    if (!isVipSource(sourceInfo.name)) {
        console.error(`Source "${sourceInfo.name}" is not in the VIP catalog.`);
        process.exit(1);
    }

    const source = await getOrCreateSource(sourceInfo.name, sourceInfo.baseUrl, sourceInfo.platform);
    sourceId = source.id;
    sessionId = await createSession(sourceId, args.url);

    console.log(`[scrape] Session #${sessionId} — ${sourceInfo.name}: ${args.url}`);

    const scraperOptions = { headless: args.headless, skipDetail: args.skipDetail };
    if (args.maxPages) scraperOptions.maxPages = args.maxPages;
    if (args.gender) scraperOptions.gender = args.gender;
    if (args.brand) scraperOptions.brand = args.brand;
    if (args.categoryHint) scraperOptions.categoryHint = args.categoryHint;

    const scraper = getScraperForUrl(args.url, scraperOptions);
    let products = [];

    try {
        products = await scraper.scrape(args.url);
    } catch (scrapeError) {
        const errorType = scraper.classifyError ? scraper.classifyError(scrapeError) : 'unknown_error';
        await logError(sessionId, sourceId, args.url, errorType, scrapeError.message);
        const duration = Math.round((Date.now() - startTime) / 1000);
        await updateSession(sessionId, 'failed', 0, 1, 0, duration);
        console.error(`Scrape failed (${errorType}): ${scrapeError.message}`);
        process.exit(1);
    }

    let totalErrors = 0;
    const validProducts = [];

    for (const product of products) {
        if (!product.title || product.title === 'Unknown') {
            totalErrors++;
            await logError(sessionId, sourceId, product.product_url || args.url, 'validation_error', 'Product has no title');
            continue;
        }
        if (!product.product_url) product.product_url = args.url;
        validProducts.push(product);
    }

    for (const p of validProducts) {
        const cur = String(p.currency || 'IDR').toUpperCase();
        if (cur !== 'IDR' && Number(p.price_idr || 0) === Number(p.price_original || 0) && Number(p.price_original || 0) > 0) {
            try {
                p.price_idr = await toIDR(p.price_original, cur);
            } catch { /* keep original */ }
        }
    }

    const dbResult = await insertProducts(validProducts, sourceId, sessionId);

    let soldOutResult = { marked: 0, skipped: true };
    try {
        if (args.partialScrape) {
            soldOutResult = { marked: 0, skipped: true, reason: 'partial scrape — sold-out sweep disabled' };
            console.log('[scrape] Sold-out sweep skipped (partial scrape)');
        } else {
            soldOutResult = await markMissingSoldOut(sourceId, new Date(startTime).toISOString(), validProducts.length);
            console.log(`[scrape] Sold-out sweep: ${soldOutResult.marked} marked`);
        }
    } catch (e) {
        console.error('[scrape] Sold-out sweep error:', e.message);
    }

    let dedupeResult = { duplicateGroups: 0, deactivated: 0, activated: 0 };
    try {
        dedupeResult = await dedupeActiveProducts();
        console.log(`[scrape] Dedupe: ${dedupeResult.deactivated} hidden, ${dedupeResult.activated} restored`);
    } catch (e) {
        console.error('[scrape] Dedupe error:', e.message);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    totalErrors += dbResult.errors;

    await updateSession(
        sessionId,
        'completed',
        validProducts.length,
        totalErrors,
        0,
        duration,
        dbResult.inserted,
        dbResult.updated
    );

    console.log('\n--- Done ---');
    console.log(`Session:     #${sessionId}`);
    console.log(`Products:    ${validProducts.length}`);
    console.log(`Inserted:    ${dbResult.inserted}`);
    console.log(`Updated:     ${dbResult.updated}`);
    console.log(`Price chg:   ${dbResult.priceChanges}`);
    console.log(`Sold out:    ${soldOutResult.marked}`);
    console.log(`Errors:      ${totalErrors}`);
    console.log(`Duration:    ${duration}s`);
}

main().catch((err) => {
    console.error('[scrape] Unexpected error:', err);
    process.exit(1);
});
