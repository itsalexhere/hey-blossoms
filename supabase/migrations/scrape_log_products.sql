-- Products touched per scrape session (for admin log detail view)
-- Run in Supabase SQL Editor

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

alter table public.scrape_log_products enable row level security;

drop policy if exists "authenticated read scrape_log_products" on public.scrape_log_products;
create policy "authenticated read scrape_log_products" on public.scrape_log_products
    for select to authenticated using (true);
