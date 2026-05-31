/**
 * Ensure VIP category tree exists in Supabase (with parent_id hierarchy).
 */
import { getSupabaseAdmin } from './supabase.js';
import { VIP_CATEGORY_TREE } from './vip-config.js';

async function upsertNode(supabase, node, parentId, lookup) {
    const { data, error } = await supabase
        .from('categories')
        .upsert({ name: node.name, slug: node.slug, parent_id: parentId }, { onConflict: 'slug' })
        .select('id, slug')
        .single();
    if (error) throw new Error(`ensure category ${node.slug} failed: ${error.message}`);
    lookup.set(node.slug, data.id);
    if (node.children?.length) {
        for (const child of node.children) {
            await upsertNode(supabase, child, data.id, lookup);
        }
    }
}

export async function buildCategorySlugLookup() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('categories').select('id, slug');
    if (error) throw new Error(`load categories failed: ${error.message}`);
    const map = new Map();
    for (const row of data || []) map.set(row.slug, row.id);
    return map;
}

export async function ensureVipCategoryTree(lookup) {
    const supabase = getSupabaseAdmin();
    for (const node of VIP_CATEGORY_TREE) {
        await upsertNode(supabase, node, null, lookup);
    }
}
