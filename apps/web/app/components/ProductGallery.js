'use client';
import { useState } from 'react';

export default function ProductGallery({ images = [], title }) {
    const [active, setActive] = useState(0);
    const list = images.length ? images : [null];

    return (
        <div>
            <div
                style={{
                    width: '100%',
                    paddingTop: '100%',
                    position: 'relative',
                    background: '#f0f0f0',
                    borderRadius: 14,
                    overflow: 'hidden',
                }}
            >
                {list[active] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={list[active]}
                        alt={title}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6e73' }}>
                        No image
                    </div>
                )}
            </div>

            {list.length > 1 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {list.map((img, i) => (
                        <button
                            key={i}
                            onClick={() => setActive(i)}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: i === active ? '2px solid #1d1d1f' : '1px solid rgba(0,0,0,0.1)',
                                padding: 0,
                                cursor: 'pointer',
                                background: '#f0f0f0',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
