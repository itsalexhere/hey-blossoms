'use client';

import { useEffect, useState } from 'react';
import WhatsAppFloat from './WhatsAppFloat';

export default function StoreWhatsApp() {
    const [whatsapp, setWhatsapp] = useState({ whatsapp_number: '', whatsapp_message: '' });

    useEffect(() => {
        fetch('/api/store/filters')
            .then((r) => r.json())
            .then((d) => {
                if (d.success && d.whatsapp) setWhatsapp(d.whatsapp);
            })
            .catch(() => {});
    }, []);

    return (
        <WhatsAppFloat
            number={whatsapp.whatsapp_number}
            message={whatsapp.whatsapp_message}
        />
    );
}
