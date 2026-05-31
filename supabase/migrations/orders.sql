-- Customer inquiry orders (checkout without payment gateway)
-- Run in Supabase SQL Editor after schema.sql

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
create index if not exists idx_orders_number on public.orders(order_number);

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

-- No public read/write — all access via service_role on server
