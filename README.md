# Luxe Store — VIP Luxury Catalog

Next.js storefront + admin panel + local Puppeteer scraper, backed by Supabase.

## Quick start

```powershell
cd js_scraper
npm install
npm run dev
```

Admin: `/admin/login` — lihat `DEPLOY.md` untuk kredensial default.

## Scrape (lokal)

```powershell
npm run scrape -- --url "https://..." --maxPages 5 --partial
```

Atau buka `/admin/scraper` → salin perintah CLI.

## Struktur monorepo

```
js_scraper/
├── .env.local          ← kredensial Supabase (wajib)
├── apps/web/           ← WEB: storefront + admin (Vercel)
├── tools/scraper/      ← SCRAPE: CLI lokal (Puppeteer)
├── packages/shared/    ← logic bersama (VIP, DB, taxonomy)
├── scripts/            ← utility (admin, remap, cleanup)
├── supabase/           ← schema SQL + migrations
├── utils/              ← re-export (kompatibilitas script lama)
├── docs/               ← dokumentasi handoff
└── _archive/           ← file lama (abaikan sehari-hari)
```

Detail: [`docs/README.md`](docs/README.md) · Deploy: [`DEPLOY.md`](DEPLOY.md)
