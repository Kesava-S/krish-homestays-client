import React, { useState, useEffect } from 'react';
import BookingForm from './BookingForm';
import './BookingModal.css';

const SESSION_KEY = 'kh_modal_shown';

export default function BookingModal() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        const timer = setTimeout(() => setVisible(true), 900);
        return () => clearTimeout(timer);
    }, []);

    const close = () => {
        sessionStorage.setItem(SESSION_KEY, '1');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="bm-overlay" onClick={close}>
            <div className="bm-modal" onClick={e => e.stopPropagation()}>

                <button className="bm-close" onClick={close} aria-label="Close">✕</button>

                {/* Promotional header */}
                <div className="bm-promo">
                    <div className="bm-promo-left">
                        <span className="bm-badge">Munnar, Kerala</span>
                        <h2>Krish Homestays</h2>
                        <p>A peaceful retreat in the heart of Kerala's tea country. Experience the silence, the mist, and the warmth of a traditional home.</p>
                        <div className="bm-highlights">
                            <div className="bm-highlight-item">🌿 <span>Mountain Views</span></div>
                            <div className="bm-highlight-item">☕ <span>Kerala Breakfast</span></div>
                            <div className="bm-highlight-item">🏡 <span>Silent Stay Policy</span></div>
                            <div className="bm-highlight-item">✅ <span>Instant Confirmation</span></div>
                            <div className="bm-highlight-item">🔒 <span>Secure Payment</span></div>
                            <div className="bm-highlight-item">📍 <span>Munnar</span></div>
                        </div>
                    </div>
                </div>

                {/* Full booking form — card styles stripped via CSS */}
                <div className="bm-form-wrapper">
                    <BookingForm />
                </div>

                <div className="bm-footer">
                    <button className="bm-skip" onClick={close}>Maybe Later — I'll explore first</button>
                </div>

            </div>
        </div>
    );
}
