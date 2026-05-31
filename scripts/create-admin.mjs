import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage:
//   node scripts/create-admin.mjs <email> <password> [fullName]
// Defaults: admin@luxe.com / Admin123!
// Creates (or updates) an auth user, confirms the email, and promotes the
// linked profile to "Super Admin".

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const content = fs.readFileSync(path.join(root, '.env.local'), 'utf-8');
for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const email = process.argv[2] || 'admin@luxe.com';
const password = process.argv[3] || 'Admin123!';
const fullName = process.argv[4] || 'Administrator';

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

// 1. Create the auth user (email pre-confirmed so login works immediately)
let userId = null;
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
});

if (createErr) {
    // If user already exists, find it and reset the password instead
    if (/already|exists|registered/i.test(createErr.message)) {
        console.log(`User ${email} already exists — resetting password...`);
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) {
            console.error('Could not locate existing user to update.');
            process.exit(1);
        }
        userId = existing.id;
        await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
        console.error('Failed to create user:', createErr.message);
        process.exit(1);
    }
} else {
    userId = created.user.id;
    console.log(`Created auth user: ${email}`);
}

// 2. Resolve the Super Admin role id
const { data: role, error: roleErr } = await supabase.from('roles').select('id').eq('name', 'Super Admin').maybeSingle();
if (roleErr || !role) {
    console.error('Super Admin role not found. Did you run schema.sql?');
    process.exit(1);
}

// 3. Ensure a profile row exists and is promoted (trigger may have created it already)
const { error: upErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, full_name: fullName, role_id: role.id }, { onConflict: 'id' });

if (upErr) {
    console.error('Failed to set profile/role:', upErr.message);
    process.exit(1);
}

console.log('\n========================================');
console.log(' Admin siap dipakai (Super Admin)');
console.log(` Email    : ${email}`);
console.log(` Password : ${password}`);
console.log(' Login di : /admin/login');
console.log('========================================');
