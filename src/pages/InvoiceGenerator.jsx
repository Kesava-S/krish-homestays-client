import React, { useState } from 'react';
import Swal from 'sweetalert2';

function generateBookingId() {
    const date = new Date();
    const yyyymmdd = date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const suffix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `KH-${yyyymmdd}-${suffix}`;
}

const makeInitialForm = () => ({
    booking_id: generateBookingId(),
    guest_name: '',
    email: '',
    phone: '',
    check_in_date: '',
    check_out_date: '',
    adults: '',
    children: '',
    room_type: 'full villa',
    total_amount: '',
    payment_type: 'full',
    advance_amount: '',
    payment_method: 'cash',
    upi_transaction_id: '',
    currency: 'INR',
});

export default function InvoiceGenerator() {
    const [form, setForm] = useState(makeInitialForm);
    const [sending, setSending] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const remainingBalance = () => {
        const total = Number(form.total_amount);
        const advance = Number(form.advance_amount);
        if (form.payment_type === 'advance' && total > 0 && advance > 0) return total - advance;
        return null;
    };

    const getBookingPayload = () => ({
        booking: {
            booking_id: form.booking_id,
            guest_name: form.guest_name,
            email: form.email,
            phone: form.phone,
            check_in_date: form.check_in_date,
            check_out_date: form.check_out_date,
            adults: form.adults,
            children: form.children,
            room_type: form.room_type,
            total_amount: form.total_amount,
        },
        payment: {
            currency: form.currency || 'INR',
            payment_method: form.payment_method,
            upi_transaction_id: form.payment_method === 'upi' ? form.upi_transaction_id : null,
            payment_type: form.payment_type,
            advance_amount: form.payment_type === 'advance' ? form.advance_amount : null,
        },
    });

    const validateForm = () => {
        const required = ['booking_id', 'guest_name', 'email', 'phone', 'check_in_date', 'check_out_date', 'total_amount'];
        for (const field of required) {
            if (!form[field]) {
                Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Please fill in all required fields.', confirmButtonColor: '#2C5F2D' });
                return false;
            }
        }
        if (form.payment_method === 'upi' && !form.upi_transaction_id.trim()) {
            Swal.fire({ icon: 'warning', title: 'Missing UPI Transaction ID', text: 'Please enter the UPI transaction ID.', confirmButtonColor: '#2C5F2D' });
            return false;
        }
        if (form.payment_type === 'advance') {
            if (!form.advance_amount || Number(form.advance_amount) <= 0) {
                Swal.fire({ icon: 'warning', title: 'Missing Advance Amount', text: 'Please enter the advance amount paid.', confirmButtonColor: '#2C5F2D' });
                return false;
            }
            if (Number(form.advance_amount) >= Number(form.total_amount)) {
                Swal.fire({ icon: 'warning', title: 'Invalid Advance Amount', text: 'Advance amount must be less than total amount. Use Full Payment instead.', confirmButtonColor: '#2C5F2D' });
                return false;
            }
        }
        return true;
    };

    const handleSendEmail = async () => {
        if (!validateForm()) return;
        setSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/send-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(getBookingPayload()),
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ icon: 'success', title: 'Invoice Sent!', text: `Invoice emailed to ${form.email}`, confirmButtonColor: '#2C5F2D' });
            } else {
                throw new Error(data.error || 'Email failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Failed', text: err.message, confirmButtonColor: '#2C5F2D' });
        } finally {
            setSending(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!validateForm()) return;
        setDownloading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(getBookingPayload()),
            });
            const data = await res.json();
            if (data.pdfBase64) {
                const byteChars = atob(data.pdfBase64);
                const byteNums = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
                const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.fileName || `invoice_${form.booking_id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                throw new Error(data.error || 'PDF generation failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Download Failed', text: err.message, confirmButtonColor: '#2C5F2D' });
        } finally {
            setDownloading(false);
        }
    };

    const handleReset = () => setForm(makeInitialForm());

    return (
        <div>
            <h2 style={{ marginBottom: '6px' }}>Invoice Generator</h2>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.92rem' }}>
                Fill in the booking details to generate and send a tax invoice.
            </p>

            <div style={styles.card}>
                {/* ── Booking Details ── */}
                <div style={styles.sectionHeader}>
                    <span style={styles.sectionDot} />
                    Booking Details
                </div>

                <div style={styles.grid}>
                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Booking ID *</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                type="text"
                                name="booking_id"
                                value={form.booking_id}
                                readOnly
                                style={{ ...styles.input, flex: 1, background: '#f8fafc', color: '#334155', fontWeight: '600', letterSpacing: '0.04em' }}
                            />
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, booking_id: generateBookingId() }))}
                                style={styles.btnRegenerate}
                                title="Generate new ID"
                            >
                                ↻
                            </button>
                        </div>
                    </div>
                    <Field label="Guest Name *" name="guest_name" value={form.guest_name} onChange={handleChange} placeholder="Full name" />
                    <Field label="Email *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="guest@email.com" />
                    <Field label="Phone *" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                    <Field label="Check-in Date *" name="check_in_date" type="date" value={form.check_in_date} onChange={handleChange} />
                    <Field label="Check-out Date *" name="check_out_date" type="date" value={form.check_out_date} onChange={handleChange} />
                    <Field label="Adults" name="adults" type="number" value={form.adults} onChange={handleChange} placeholder="2" />
                    <Field label="Children" name="children" type="number" value={form.children} onChange={handleChange} placeholder="0" />

                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Room Type</label>
                        <select name="room_type" value={form.room_type} onChange={handleChange} style={styles.input}>
                            <option value="full villa">Full Villa</option>
                            <option value="half villa">Half Villa</option>
                            <option value="remaining">Remaining Room</option>
                        </select>
                    </div>

                    <Field label="Total Amount (₹) *" name="total_amount" type="number" value={form.total_amount} onChange={handleChange} placeholder="5000" />
                </div>

                {/* ── Payment Details ── */}
                <div style={{ ...styles.sectionHeader, marginTop: '24px' }}>
                    <span style={styles.sectionDot} />
                    Payment Details
                </div>

                <div style={styles.grid}>
                    {/* Payment Type — full-width */}
                    <div style={{ ...styles.fieldWrap, gridColumn: '1 / -1' }}>
                        <label style={styles.label}>Payment Type *</label>
                        <div style={{ display: 'flex', gap: '0' }}>
                            <label style={{
                                ...styles.toggleOption,
                                background: form.payment_type === 'full' ? '#2C5F2D' : '#f8fafc',
                                color: form.payment_type === 'full' ? '#fff' : '#475569',
                                borderRadius: '6px 0 0 6px',
                            }}>
                                <input type="radio" name="payment_type" value="full" checked={form.payment_type === 'full'} onChange={handleChange} style={{ display: 'none' }} />
                                Full Payment
                            </label>
                            <label style={{
                                ...styles.toggleOption,
                                background: form.payment_type === 'advance' ? '#d97706' : '#f8fafc',
                                color: form.payment_type === 'advance' ? '#fff' : '#475569',
                                borderRadius: '0 6px 6px 0',
                                borderLeft: 'none',
                            }}>
                                <input type="radio" name="payment_type" value="advance" checked={form.payment_type === 'advance'} onChange={handleChange} style={{ display: 'none' }} />
                                Advance Payment
                            </label>
                        </div>
                    </div>

                    {/* Advance Amount + Remaining Balance — only for advance */}
                    {form.payment_type === 'advance' && (<>
                        <Field label="Advance Amount Paid (₹) *" name="advance_amount" type="number" value={form.advance_amount} onChange={handleChange} placeholder="e.g. 2000" />
                        <div style={styles.fieldWrap}>
                            <label style={styles.label}>Remaining Balance (₹)</label>
                            <input
                                type="text"
                                readOnly
                                value={remainingBalance() !== null ? `₹ ${remainingBalance()}` : '—'}
                                style={{ ...styles.input, background: '#fff7ed', color: '#b45309', fontWeight: '700', border: '1.5px solid #fed7aa' }}
                            />
                        </div>

                        {/* Inline notice */}
                        <div style={{ gridColumn: '1 / -1', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 14px', fontSize: '0.84rem', color: '#92400e' }}>
                            <strong>Note:</strong> The remaining balance of{' '}
                            <strong>{remainingBalance() !== null ? `₹${remainingBalance()}` : '—'}</strong>{' '}
                            will be mentioned in the invoice as due before or during check-in.
                        </div>
                    </>)}

                    {/* Payment Method toggle */}
                    <div style={{ ...styles.fieldWrap, gridColumn: '1 / -1' }}>
                        <label style={styles.label}>Payment Method *</label>
                        <div style={{ display: 'flex', gap: '0' }}>
                            <label style={{
                                ...styles.toggleOption,
                                background: form.payment_method === 'cash' ? '#1e293b' : '#f8fafc',
                                color: form.payment_method === 'cash' ? '#fff' : '#475569',
                                borderRadius: '6px 0 0 6px',
                            }}>
                                <input type="radio" name="payment_method" value="cash" checked={form.payment_method === 'cash'} onChange={handleChange} style={{ display: 'none' }} />
                                Cash
                            </label>
                            <label style={{
                                ...styles.toggleOption,
                                background: form.payment_method === 'upi' ? '#1e293b' : '#f8fafc',
                                color: form.payment_method === 'upi' ? '#fff' : '#475569',
                                borderRadius: '0 6px 6px 0',
                                borderLeft: 'none',
                            }}>
                                <input type="radio" name="payment_method" value="upi" checked={form.payment_method === 'upi'} onChange={handleChange} style={{ display: 'none' }} />
                                UPI
                            </label>
                        </div>
                    </div>

                    {/* UPI Transaction ID — only when UPI */}
                    {form.payment_method === 'upi' && (
                        <Field label="UPI Transaction ID *" name="upi_transaction_id" value={form.upi_transaction_id} onChange={handleChange} placeholder="e.g. 123456789012" />
                    )}
                </div>

                {/* ── Actions ── */}
                <div style={styles.actions}>
                    <button onClick={handleReset} style={styles.btnReset}>
                        Reset Form
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                            style={{ ...styles.btnOutline, opacity: downloading ? 0.6 : 1 }}
                        >
                            {downloading ? 'Generating…' : '⬇ Download PDF'}
                        </button>
                        <button
                            onClick={handleSendEmail}
                            disabled={sending}
                            style={{ ...styles.btnPrimary, opacity: sending ? 0.6 : 1 }}
                        >
                            {sending ? 'Sending…' : '✉ Send via Email'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, name, value, onChange, type = 'text', placeholder }) {
    return (
        <div style={styles.fieldWrap}>
            <label style={styles.label}>{label}</label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={styles.input}
            />
        </div>
    );
}

const styles = {
    card: {
        background: '#fff',
        borderRadius: '10px',
        padding: '28px 32px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        maxWidth: '860px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.88rem',
        fontWeight: '700',
        color: '#1e293b',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '16px',
    },
    sectionDot: {
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#2C5F2D',
        flexShrink: 0,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '14px 20px',
    },
    fieldWrap: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        fontSize: '0.82rem',
        fontWeight: '600',
        color: '#475569',
        marginBottom: '5px',
    },
    input: {
        padding: '9px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '0.9rem',
        fontFamily: 'Outfit, sans-serif',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '28px',
        paddingTop: '20px',
        borderTop: '1px solid #e2e8f0',
    },
    btnPrimary: {
        padding: '10px 22px',
        background: '#2C5F2D',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
    },
    btnOutline: {
        padding: '10px 22px',
        background: '#fff',
        color: '#2C5F2D',
        border: '1.5px solid #2C5F2D',
        borderRadius: '6px',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
    },
    btnReset: {
        padding: '10px 22px',
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
    },
    toggleOption: {
        padding: '9px 22px',
        border: '1px solid #cbd5e1',
        fontWeight: '600',
        fontSize: '0.88rem',
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
        transition: 'background 0.15s, color 0.15s',
        userSelect: 'none',
    },
    btnRegenerate: {
        padding: '0 12px',
        background: '#f1f5f9',
        color: '#2C5F2D',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '1.1rem',
        cursor: 'pointer',
        fontWeight: '700',
        flexShrink: 0,
    },
};
