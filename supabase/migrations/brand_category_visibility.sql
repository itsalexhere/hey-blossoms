-- Hide/unhide brands and categories on storefront (products under hidden taxonomy are excluded).
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.brands add column if not exists is_visible boolean not null default true;
alter table public.categories add column if not exists is_visible boolean not null default true;
