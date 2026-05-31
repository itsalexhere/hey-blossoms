-- VIP catalog: gender column only
-- Run in Supabase SQL Editor (safe to re-run).
-- Categories & brands are managed via Admin panel — do not seed here.

alter table public.products add column if not exists gender text;
create index if not exists idx_products_gender on public.products(gender);
