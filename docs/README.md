# Luxe Store — Developer Guide

Monorepo untuk VIP luxury storefront + admin panel + scraper lokal.

## Struktur folder

```
js_scraper/
├── apps/web/           Next.js storefront + admin (deploy ke Vercel)
├── tools/scraper/      Puppeteer CLI (jalan di laptop)
├── packages/shared/    VIP config, taxonomy, DB layer, Supabase admin client
├── scripts/            Utility scripts (admin, remap, cleanup)
├── supabase/           Schema SQL + migrations
└── docs/               Dokumentasi handoff
```

## Quick start

```powershell
cd js_scraper
npm install
npm run dev          # http://localhost:3000
```

Env: salin `env.example.txt` → `.env.local` di root `js_scraper/` (Supabase URL + keys).

## Scrape produk (lokal)

```powershell
cd js_scraper
npm run scrape -- --url "https://www.huntstreet.com/..." --maxPages 5 --partial
```

Atau buka `/admin/scraper` → salin perintah CLI yang sudah di-generate.

## Scripts utilitas

| Script | Fungsi |
|--------|--------|
| `node scripts/create-admin.mjs` | Buat/reset user admin |
| `node scripts/remap-product-categories.mjs` | Remap kategori produk ke VIP tree |
| `node scripts/cleanup-vip-catalog.mjs` | Bersihkan produk/brand non-VIP |

## VIP scope

- **Sources:** HuntStreet, ZetaBags, Banananina, Yoogi's Closet
- **Brands:** Louis Vuitton, Dior, Loro Piana

## Deploy

Lihat [`DEPLOY.md`](../DEPLOY.md) — Vercel root directory: `js_scraper/apps/web`.
