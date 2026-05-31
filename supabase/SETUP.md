# Supabase Setup — Phase 1

Langkah sekali jalan untuk menghubungkan scraper ke Supabase.

## 1. Buat project Supabase
1. Buka https://supabase.com -> Sign in -> **New project**.
2. Isi nama project + database password (simpan password-nya).
3. Pilih region terdekat (mis. Southeast Asia / Singapore).
4. Tunggu project selesai dibuat (~1-2 menit).

## 2. Jalankan schema
1. Di dashboard Supabase, buka **SQL Editor** > **New query**.
2. Copy seluruh isi file [`schema.sql`](./schema.sql), paste, klik **Run**.
3. Pastikan tidak ada error. Ini membuat semua tabel + seed roles/categories + RLS.

## 3. Ambil API keys
1. Buka **Project Settings** (ikon gear) > **API**.
2. Copy 3 nilai ini ke file `.env.local` di folder `js_scraper`:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (klik "Reveal") -> `SUPABASE_SERVICE_ROLE_KEY`

Contoh `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> PENTING: `service_role` key bersifat rahasia. Jangan commit `.env.local` ke git (sudah di-gitignore).

## 4. Migrasi data lama (database.json -> Supabase)
Dari folder `js_scraper`:
```
node scripts/migrate-to-supabase.mjs
```
Script ini idempotent (aman dijalankan ulang) karena upsert by `source_url`.

## 5. Test scraper menulis ke Supabase
1. Jalankan `npm run dev`.
2. Buka web, scrape salah satu situs (mis. ZetaBags).
3. Cek di Supabase **Table Editor** > `products` dan `scrape_logs` bahwa data masuk.

## 6. Buat admin pertama (untuk Phase 3 nanti)
1. Supabase dashboard > **Authentication** > **Users** > **Add user** (email + password).
2. Promote jadi Super Admin via SQL Editor:
```sql
update public.profiles
set role_id = (select id from public.roles where name = 'Super Admin')
where email = 'your-admin@email.com';
```

Setelah langkah 1-5 berhasil, Phase 1 selesai: scraper jalan manual dari laptop dan data langsung masuk Supabase lengkap dengan log waktu scrape, status stok, dan qty.

## 7. VIP catalog (filter + wishlist)

Untuk database yang sudah jalan sebelum fitur VIP:

1. **SQL Editor** — copy isi [`migrations/vip_taxonomy.sql`](./migrations/vip_taxonomy.sql), Run (hanya menambah kolom `products.gender`).
2. **Kelola kategori** via Admin → Kategori (gunakan `parent_id` untuk hierarki, mis. Apparel → Tops). Brand via Admin → Brands.
3. **Map produk lama** yang belum punya gender/kategori (hanya mengisi field kosong):
   ```
   node scripts/map-product-taxonomy.mjs
   ```

Storefront `/` memakai filter Gender, Kategori (tree dari DB), Rentang Harga, sort A–Z, keranjang + checkout inquiry. Admin **Products** punya Export/Import Excel.

## 8. Pesanan customer (checkout inquiry)

Jalankan di **SQL Editor**:

1. [`migrations/orders.sql`](./migrations/orders.sql) — tabel `orders` + `order_items`

Setelah itu checkout dari storefront akan menyimpan pesanan ke Supabase. Admin lihat di **Pesanan** (`/admin/orders`) + export Excel.
