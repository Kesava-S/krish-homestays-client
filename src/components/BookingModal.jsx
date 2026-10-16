import React, { useState, useEffect } from 'react';
import BookingForm from './BookingForm';
import { X, Mountain, Coffee, Home, CheckCircle2, Lock, MapPin } from 'lucide-react';
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

                <button className="bm-close" onClick={close} aria-label="Close">
                    <X size={18} />
                </button>

                {/* Promotional header */}
                <div className="bm-promo">
                    <div className="bm-promo-left">
                        <span className="bm-badge">Munnar, Kerala</span>
                        <h2>Krish Homestays</h2>
                        <p>A peaceful retreat in the heart of Kerala's tea country. Experience the silence, the mist, and the warmth of a traditional home.</p>
                        <div className="bm-highlights">
                            <div className="bm-highlight-item"><Mountain size={15} color="#fff" /> <span>Mountain Views</span></div>
                            <div className="bm-highlight-item"><Coffee size={15} color="#fff" /> <span>Kerala Breakfast</span></div>
                            <div className="bm-highlight-item"><Home size={15} color="#fff" /> <span>Silent Stay Policy</span></div>
                            <div className="bm-highlight-item"><CheckCircle2 size={15} color="#fff" /> <span>Instant Confirmation</span></div>
                            <div className="bm-highlight-item"><Lock size={15} color="#fff" /> <span>Secure Payment</span></div>
                            <div className="bm-highlight-item"><MapPin size={15} color="#fff" /> <span>Munnar</span></div>
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
