-- VIP category tree (run once in Supabase SQL Editor if categories are missing)
-- Safe to re-run: upserts by slug.

insert into public.categories (name, slug, parent_id) values
    ('Apparel', 'apparel', null),
    ('Fashion Goods', 'fashion-goods', null),
    ('Bag', 'bag', null),
    ('Wallet', 'wallet', null),
    ('Shoes', 'shoes', null),
    ('Jewelry/Accessories', 'jewelry-accessories', null)
on conflict (slug) do update set name = excluded.name;

insert into public.categories (name, slug, parent_id)
select 'Tops', 'tops', id from public.categories where slug = 'apparel'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.categories (name, slug, parent_id)
select 'Bottoms', 'bottoms', id from public.categories where slug = 'apparel'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.categories (name, slug, parent_id)
select 'Outwear', 'outwear', id from public.categories where slug = 'apparel'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.categories (name, slug, parent_id)
select 'Scarf', 'scarf', id from public.categories where slug = 'fashion-goods'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.categories (name, slug, parent_id)
select 'Sunglasses', 'sunglasses', id from public.categories where slug = 'fashion-goods'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.categories (name, slug, parent_id)
select 'Belt', 'belt', id from public.categories where slug = 'fashion-goods'
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id;
