'use client';
import { useState } from 'react';

export default function ProductGallery({ images = [], title }) {
    const [active, setActive] = useState(0);
    const list = (images || []).filter(Boolean);
    const count = list.length;
    const current = count ? list[Math.min(active, count - 1)] : null;

    function goPrev() {
        setActive((i) => (i <= 0 ? count - 1 : i - 1));
    }

    function goNext() {
        setActive((i) => (i >= count - 1 ? 0 : i + 1));
    }

    return (
        <div className="product-gallery">
            <div
                style={{
                    width: '100%',
                    paddingTop: '100%',
                    position: 'relative',
                    background: '#e8e8e8',
                    borderRadius: 14,
                    overflow: 'hidden',
                }}
            >
                {current ? (
                    <>
                        {count > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={goPrev}
                                    aria-label="Foto sebelumnya"
                                    style={navBtnStyle('left')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    onClick={goNext}
                                    aria-label="Foto berikutnya"
                                    style={navBtnStyle('right')}
                                >
                                    ›
                                </button>
                            </>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={current}
                            alt={title}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.opacity = '0.3';
                            }}
                        />
                        {count > 1 && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.55)',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    borderRadius: 20,
                                }}
                            >
                                {Math.min(active, count - 1) + 1} / {count}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6e73' }}>
                        No image
                    </div>
                )}
            </div>

            {count > 1 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {list.map((img, i) => (
                        <button
                            key={`${img}-${i}`}
                            type="button"
                            onClick={() => setActive(i)}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: i === active ? '2px solid #1d1d1f' : '1px solid rgba(0,0,0,0.1)',
                                padding: 0,
                                cursor: 'pointer',
                                background: '#e8e8e8',
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

function navBtnStyle(side) {
    return {
        position: 'absolute',
        top: '50%',
        [side]: 10,
        transform: 'translateY(-50%)',
        zIndex: 3,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        fontSize: '1.5rem',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1d1d1f',
    };
}
