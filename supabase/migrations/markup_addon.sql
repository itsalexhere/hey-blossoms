-- Per-product manual markup (nominal IDR). NULL = use global markup_percent.
-- Run in Supabase SQL Editor after schema.sql

alter table public.products
    add column if not exists markup_addon_idr numeric(14,2);

insert into public.settings (key, value) values
    ('whatsapp_number', ''),
    ('whatsapp_message', 'Halo, saya tertarik dengan produk di toko Anda.')
on conflict (key) do nothing;
