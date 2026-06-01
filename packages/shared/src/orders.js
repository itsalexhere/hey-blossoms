import { getSupabaseAdmin } from './supabase.js';
import { computeSellingPrice } from './pricing.js';
import { VIP_SOURCES } from './vip-config.js';

const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled'];

async function getMarkupPercent() {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('settings').select('value').eq('key', 'markup_percent').maybeSingle();
    return Number(data?.value ?? 20) || 0;
}

function applyMarkup(originalPrice, markupPercent, markupAddonIdr = null) {
    return computeSellingPrice(originalPrice, markupPercent, markupAddonIdr);
}

async function generateOrderNumber(supabase) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `LX-${today}-`;
    const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .like('order_number', `${prefix}%`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}${seq}`;
}

/**
 * Create an inquiry order with line-item snapshots.
 */
export async function createOrder({ customer_name, phone, address, notes, items }) {
    if (!customer_name?.trim()) throw new Error('Nama wajib diisi');
    if (!phone?.trim()) throw new Error('No. HP wajib diisi');
    if (!address?.trim()) throw new Error('Alamat wajib diisi');
    if (!Array.isArray(items) || items.length === 0) throw new Error('Keranjang kosong');

    const supabase = getSupabaseAdmin();
    const markup = await getMarkupPercent();

    const productIds = items.map((i) => Number(i.product_id)).filter(Boolean);
    if (productIds.length !== items.length) throw new Error('Product ID tidak valid');

    const { data: products, error: fetchErr } = await supabase
        .from('products')
        .select('id, title, source, source_url, original_price, markup_addon_idr, stock_status, stock_qty, is_active, brands(name), product_images(image_url, position)')
        .in('id', productIds)
        .in('source', VIP_SOURCES);

    if (fetchErr) throw new Error(fetchErr.message);

    const productMap = new Map((products || []).map((p) => [p.id, p]));
    const lineItems = [];
    let totalAmount = 0;
    let itemCount = 0;

    for (const item of items) {
        const pid = Number(item.product_id);
        const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
        const p = productMap.get(pid);

        if (!p) throw new Error(`Produk #${pid} tidak ditemukan`);
        if (!p.is_active || p.stock_status !== 'available') {
            throw new Error(`"${p.title}" tidak tersedia`);
        }
        if (p.stock_qty != null && qty > p.stock_qty) {
            throw new Error(`Stok "${p.title}" hanya ${p.stock_qty}`);
        }

        const unitPrice = applyMarkup(p.original_price, markup, p.markup_addon_idr);
        const lineTotal = unitPrice * qty;
        const imgs = (p.product_images || []).sort((a, b) => a.position - b.position);

        lineItems.push({
            product_id: pid,
            title: p.title,
            brand: p.brands?.name || null,
            source: p.source || null,
            source_url: p.source_url || null,
            image_url: imgs[0]?.image_url || null,
            unit_price: unitPrice,
            qty,
            line_total: lineTotal,
        });

        totalAmount += lineTotal;
        itemCount += qty;
    }

    const orderNumber = await generateOrderNumber(supabase);
    const now = new Date().toISOString();

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
            order_number: orderNumber,
            customer_name: customer_name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            notes: notes?.trim() || null,
            status: 'pending',
            total_amount: totalAmount,
            item_count: itemCount,
            updated_at: now,
        })
        .select('id, order_number, total_amount, item_count, created_at')
        .single();

    if (orderErr) throw new Error(orderErr.message);

    const rows = lineItems.map((li) => ({ ...li, order_id: order.id }));
    const { error: itemsErr } = await supabase.from('order_items').insert(rows);
    if (itemsErr) throw new Error(itemsErr.message);

    return { ...order, total_amount: Number(order.total_amount) };
}

export async function getOrders({ status, search, limit = 50, offset = 0 } = {}) {
    const supabase = getSupabaseAdmin();

    let q = supabase
        .from('orders')
        .select('id, order_number, customer_name, phone, address, notes, status, total_amount, item_count, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (status && ORDER_STATUSES.includes(status)) q = q.eq('status', status);
    if (search) {
        const s = `%${search}%`;
        q = q.or(`customer_name.ilike.${s},phone.ilike.${s},order_number.ilike.${s}`);
    }

    q = q.range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
        orders: (data || []).map((o) => ({
            ...o,
            total_amount: Number(o.total_amount || 0),
        })),
        total: count ?? 0,
    };
}

export async function getOrderById(id) {
    const supabase = getSupabaseAdmin();

    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) return null;

    const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
        .order('id');

    if (itemsErr) throw new Error(itemsErr.message);

    return {
        ...order,
        total_amount: Number(order.total_amount || 0),
        items: (items || []).map((i) => ({
            ...i,
            unit_price: Number(i.unit_price || 0),
            line_total: Number(i.line_total || 0),
        })),
    };
}

export async function updateOrderStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) throw new Error('Status tidak valid');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, order_number, status')
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Pesanan tidak ditemukan');
    return data;
}

/** Flat rows for Excel export (one row per order item). */
export async function getOrdersForExport({ status, search } = {}) {
    const supabase = getSupabaseAdmin();

    let q = supabase
        .from('orders')
        .select('id, order_number, customer_name, phone, address, notes, status, total_amount, item_count, created_at')
        .order('created_at', { ascending: false });

    if (status && ORDER_STATUSES.includes(status)) q = q.eq('status', status);
    if (search) {
        const s = `%${search}%`;
        q = q.or(`customer_name.ilike.${s},phone.ilike.${s},order_number.ilike.${s}`);
    }

    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);
    if (!orders?.length) return [];

    const orderIds = orders.map((o) => o.id);
    const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('order_id')
        .order('id');

    if (itemsErr) throw new Error(itemsErr.message);

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const rows = [];

    for (const item of items || []) {
        const o = orderMap.get(item.order_id);
        if (!o) continue;
        rows.push({
            order_number: o.order_number,
            created_at: o.created_at,
            customer_name: o.customer_name,
            phone: o.phone,
            address: o.address,
            notes: o.notes || '',
            status: o.status,
            product_title: item.title,
            brand: item.brand || '',
            source: item.source || '',
            source_url: item.source_url || '',
            qty: item.qty,
            unit_price: Number(item.unit_price || 0),
            line_total: Number(item.line_total || 0),
            order_total: Number(o.total_amount || 0),
        });
    }

    return rows;
}

export { ORDER_STATUSES };
