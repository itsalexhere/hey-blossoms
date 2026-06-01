-- ============================================================
-- Product Scraping System — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ------------------------------------------------------------
-- 1. ROLES (master role: Super Admin / Admin / Staff)
-- ------------------------------------------------------------
create table if not exists public.roles (
    id          bigint generated always as identity primary key,
    name        text not null unique,
    created_at  timestamptz not null default now()
);

insert into public.roles (name) values
    ('Super Admin'),
    ('Admin'),
    ('Staff')
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- 2. PROFILES (links Supabase Auth user -> role)
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text,
    full_name   text,
    role_id     bigint references public.roles(id),
    created_at  timestamptz not null default now()
);

-- Auto-create a profile (default role: Staff) whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, role_id)
    values (
        new.id,
        new.email,
        (select id from public.roles where name = 'Staff' limit 1)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. BRANDS (master)
-- ------------------------------------------------------------
create table if not exists public.brands (
    id          bigint generated always as identity primary key,
    name        text not null unique,
    slug        text unique,
    created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. CATEGORIES (master; parent_id supports hierarchy e.g. Men > Bag)
-- ------------------------------------------------------------
create table if not exists public.categories (
    id          bigint generated always as identity primary key,
    name        text not null,
    slug        text unique,
    parent_id   bigint references public.categories(id) on delete set null,
    created_at  timestamptz not null default now()
);

insert into public.categories (name, slug) values
    ('Men', 'men'),
    ('Women', 'women')
on conflict (slug) do nothing;

-- VIP product categories: run supabase/migrations/vip_categories.sql
-- or `node scripts/remap-product-categories.mjs` (seeds tree automatically).

-- ------------------------------------------------------------
-- 5. PRODUCTS (main scraped data)
--    original_price is stored in IDR (canonical, used by admin + markup base)
-- ------------------------------------------------------------
create table if not exists public.products (
    id              bigint generated always as identity primary key,
    source          text,                       -- e.g. Banananina, ZetaBags
    source_url      text not null unique,        -- dedupe key
    title           text not null,
    brand_id        bigint references public.brands(id) on delete set null,
    category_id     bigint references public.categories(id) on delete set null,
    original_price  numeric(14,2) not null default 0,   -- in IDR
    markup_addon_idr numeric(14,2),                  -- manual nominal upping; NULL = global %
    currency        text default 'IDR',
    original_amount numeric(14,2),               -- raw amount in source currency (admin reference)
    stock_status    text default 'available',    -- available | sold_out | out_of_stock
    stock_qty       integer,
    gender          text,                       -- men | women (VIP filter)
    description     text,
    is_active       boolean not null default true,
    scraped_at      timestamptz default now(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_stock on public.products(stock_status);
create index if not exists idx_products_gender on public.products(gender);
create index if not exists idx_products_scraped on public.products(scraped_at desc);

-- ------------------------------------------------------------
-- 6. PRODUCT_IMAGES (many images per product)
-- ------------------------------------------------------------
create table if not exists public.product_images (
    id          bigint generated always as identity primary key,
    product_id  bigint not null references public.products(id) on delete cascade,
    image_url   text not null,
    position    integer not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images(product_id);
-- prevent duplicate image rows per product
create unique index if not exists uq_product_image on public.product_images(product_id, image_url);

-- ------------------------------------------------------------
-- 7. SCRAPE_LOGS (history of scraping runs)
-- ------------------------------------------------------------
create table if not exists public.scrape_logs (
    id                bigint generated always as identity primary key,
    source            text,
    scrape_url        text,
    status            text default 'running',    -- running | completed | failed
    total_products    integer default 0,
    inserted          integer default 0,
    updated           integer default 0,
    errors            integer default 0,
    duration_seconds  integer default 0,
    started_at        timestamptz default now(),
    completed_at      timestamptz
);

create index if not exists idx_scrape_logs_started on public.scrape_logs(started_at desc);

-- ------------------------------------------------------------
-- 7b. SCRAPE_ERRORS (detailed error log per scrape run)
-- ------------------------------------------------------------
create table if not exists public.scrape_errors (
    id          bigint generated always as identity primary key,
    log_id      bigint references public.scrape_logs(id) on delete cascade,
    source      text,
    url         text,
    error_type  text,
    message     text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_scrape_errors_created on public.scrape_errors(created_at desc);
create index if not exists idx_scrape_errors_log on public.scrape_errors(log_id);

-- ------------------------------------------------------------
-- 7c. SCRAPE_LOG_PRODUCTS (products touched per scrape session)
-- ------------------------------------------------------------
create table if not exists public.scrape_log_products (
    id          bigint generated always as identity primary key,
    log_id      bigint not null references public.scrape_logs(id) on delete cascade,
    product_id  bigint not null references public.products(id) on delete cascade,
    action      text not null default 'updated',
    created_at  timestamptz not null default now(),
    constraint scrape_log_products_action_check check (action in ('inserted', 'updated')),
    unique (log_id, product_id)
);

create index if not exists idx_scrape_log_products_log on public.scrape_log_products(log_id);
create index if not exists idx_scrape_log_products_product on public.scrape_log_products(product_id);

-- ------------------------------------------------------------
-- 8. SETTINGS (global key-value; markup_percent etc.)
-- ------------------------------------------------------------
create table if not exists public.settings (
    key         text primary key,
    value       text,
    updated_at  timestamptz not null default now()
);

insert into public.settings (key, value) values
    ('markup_percent', '20'),
    ('whatsapp_number', ''),
    ('whatsapp_message', 'Halo, saya tertarik dengan produk di toko Anda.')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
--    Public (anon) can READ storefront data only.
--    Writes happen via service_role key (bypasses RLS) from the scraper/admin server.
-- ------------------------------------------------------------
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.categories     enable row level security;
alter table public.brands         enable row level security;
alter table public.settings       enable row level security;
alter table public.scrape_logs    enable row level security;
alter table public.scrape_errors  enable row level security;
alter table public.scrape_log_products enable row level security;
alter table public.profiles       enable row level security;
alter table public.roles          enable row level security;

-- Public read for storefront tables
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
    for select using (true);

drop policy if exists "public read product_images" on public.product_images;
create policy "public read product_images" on public.product_images
    for select using (true);

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
    for select using (true);

drop policy if exists "public read brands" on public.brands;
create policy "public read brands" on public.brands
    for select using (true);

-- markup_percent must be readable by storefront to compute selling price
drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings
    for select using (true);

-- Authenticated admins can read their own profile + roles
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
    for select using (auth.uid() = id);

drop policy if exists "authenticated read roles" on public.roles;
create policy "authenticated read roles" on public.roles
    for select using (auth.role() = 'authenticated');

-- scrape_logs: only authenticated users can read (admin monitoring)
drop policy if exists "authenticated read scrape_logs" on public.scrape_logs;
create policy "authenticated read scrape_logs" on public.scrape_logs
    for select using (auth.role() = 'authenticated');

-- scrape_errors: only authenticated users can read (admin monitoring)
drop policy if exists "authenticated read scrape_errors" on public.scrape_errors;
create policy "authenticated read scrape_errors" on public.scrape_errors
    for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated read scrape_log_products" on public.scrape_log_products;
create policy "authenticated read scrape_log_products" on public.scrape_log_products
    for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 10. ORDERS (customer inquiry checkout — no payment gateway)
-- ------------------------------------------------------------
create table if not exists public.orders (
    id              bigint generated always as identity primary key,
    order_number    text not null unique,
    customer_name   text not null,
    phone           text not null,
    address         text not null,
    notes           text,
    status          text not null default 'pending',
    total_amount    numeric(14,2) not null default 0,
    item_count      integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);

create table if not exists public.order_items (
    id              bigint generated always as identity primary key,
    order_id        bigint not null references public.orders(id) on delete cascade,
    product_id      bigint references public.products(id) on delete set null,
    title           text not null,
    brand           text,
    source          text,
    source_url      text,
    image_url       text,
    unit_price      numeric(14,2) not null default 0,
    qty             integer not null default 1,
    line_total      numeric(14,2) not null default 0,
    created_at      timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- NOTE: No INSERT/UPDATE/DELETE policies are defined for anon/authenticated.
-- All writes (scraper inserts, admin edits) use the service_role key on the
-- server, which bypasses RLS. This keeps the public site read-only.

-- ============================================================
-- SETUP DONE.
-- After creating your first admin user in Supabase Auth (Authentication > Users),
-- promote them to Super Admin by running:
--
--   update public.profiles
--   set role_id = (select id from public.roles where name = 'Super Admin')
--   where email = 'your-admin@email.com';
-- ============================================================
