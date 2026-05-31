import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/supabase/server';
import AdminShell from '../../components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }) {
    const admin = await getCurrentAdmin();
    if (!admin) redirect('/admin/login');

    return <AdminShell admin={admin}>{children}</AdminShell>;
}
