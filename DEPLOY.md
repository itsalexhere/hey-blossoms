# Panduan Deploy — Luxe Store (Next.js + Supabase)

Sistem terdiri dari 3 bagian:

| Bagian | Lokasi | Cara jalan |
|--------|--------|-----------|
| **Database** | Supabase (cloud) | Selalu online |
| **Web (storefront + admin)** | Vercel (cloud) | Selalu online |
| **Scraper** | Laptop kamu | Dijalankan manual saat ingin update produk |

---

## 1. Supabase (sudah jalan)

Database sudah dibuat di project Supabase kamu. Jika perlu setup ulang,
lihat `supabase/SETUP.md`. Pastikan `supabase/schema.sql` sudah dijalankan dan
minimal ada 1 user admin (lihat langkah 4).

---

## 2. Deploy Web ke Vercel

1. Push project ke GitHub (sudah dilakukan).
2. Buka [vercel.com](https://vercel.com) → **Add New → Project** → import repo ini.
3. **Root Directory**: pilih `js_scraper/apps/web`.
4. Framework otomatis terdeteksi **Next.js**. Biarkan default build command.
5. Di **Environment Variables**, tambahkan (ambil dari `.env.local`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

   > `SUPABASE_SERVICE_ROLE_KEY` bersifat rahasia — hanya dipakai di server, jangan
   > diberi prefix `NEXT_PUBLIC_`.

6. Klik **Deploy**. Setelah selesai:
   - Storefront publik: `https://<project>.vercel.app/`
   - Admin panel (tersembunyi): `https://<project>.vercel.app/admin`

> **Catatan scraper di Vercel:** scraping **tidak** berjalan di Vercel (Puppeteer hanya di laptop).
> Halaman `/admin/scraper` menampilkan perintah CLI untuk dijalankan lokal.

---

## 3. Menjalankan Scraper dari Laptop

Scraper menulis langsung ke Supabase yang sama dengan web, jadi hasil scrape
langsung tampil di storefront.

```powershell
cd js_scraper
npm install
npm run scrape -- --url "https://www.huntstreet.com/..." --maxPages 5 --partial
```

Opsi lain: buka `http://localhost:3000/admin/scraper` → salin perintah CLI.

Contoh dengan gender/brand:

```powershell
npm run scrape -- --url "https://..." --maxPages 10 --gender women --brand "Louis Vuitton"
```

Alur data: scrape listing → cek produk ada/tidak (by `source_url`) → insert/update →
log ke tabel `scrape_logs`.

---

## 4. Membuat User Admin Pertama

1. Supabase Dashboard → **Authentication → Users → Add user** (isi email + password).
2. Jadikan Super Admin via **SQL Editor**:

   ```sql
   update public.profiles
   set role_id = (select id from public.roles where name = 'Super Admin')
   where email = 'email-admin-kamu@contoh.com';
   ```

3. Login di `/admin/login`.

---

## 5. Logika Harga (penting)

- Admin mengisi/melihat **harga asli** (`original_price`) di `/admin/products`.
- Pelanggan melihat **harga jual** = `harga_asli × (1 + markup% / 100)`.
- Markup diatur di `/admin/settings` (default 20%). Harga asli tidak pernah tampil di storefront.
