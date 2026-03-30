import React, { useState } from 'react';
import Swal from 'sweetalert2';

// ── Refund Calculator ──────────────────────────────────────────────
const calculateRefund = (checkInDate, totalAmount) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil((checkIn - today) / (1000 * 60 * 60 * 24));

    let refundPercent = 0;
    let refundAmount = 0;
    let policy = '';
    let eligible = true;

    if (daysLeft >= 4) {
        refundPercent = 100;
        refundAmount = totalAmount;
        policy = '7+ days before check-in — Full refund';
    } else if (daysLeft >= 1 && daysLeft < 4) {
        refundPercent = 50;
        refundAmount = Math.round(totalAmount * 0.5);
        policy = 'Within 4 days of check-in — 50% refund';
    } else {
        refundPercent = 0;
        refundAmount = 0;
        policy = 'Same day or no-show — No refund';
        eligible = false;
    }

    return { daysLeft, refundPercent, refundAmount, policy, eligible };
};

export default function Cancellation() {
    const [bookingId, setBookingId] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [bookingInfo, setBookingInfo] = useState(null);
    const [refundInfo, setRefundInfo] = useState(null);
    const [error, setError] = useState('');

    // ── Step 1: Verify Booking ID ──────────────────────────────────
    const handleVerify = async () => {
        setError('');
        setBookingInfo(null);
        setRefundInfo(null);

        if (!bookingId.trim()) {
            setError('Please enter your Booking ID');
            return;
        }

        const idPattern = /^KH-\d{8}-[A-Z0-9]{5}$/;
        if (!idPattern.test(bookingId.trim().toUpperCase())) {
            setError('Invalid Booking ID format. Example: KH-20250215-8XK2Q');
            return;
        }

        setVerifying(true);

        try {
            const res = await fetch(
                `${import.meta.env.VITE_N8N_URL}/booking-enquiry?booking_id=${bookingId.trim().toUpperCase()}`
            );
            const raw = await res.json();
            const data = Array.isArray(raw) ? raw[0] : raw;

            if (!data || !data['Booking_id']) {
                setError('Booking ID not found. Please check and try again.');
                return;
            }

            // ✅ Check if already cancelled
            if (data['Status']?.toLowerCase() === 'cancelled') {
                setError('This booking has already been cancelled.');
                return;
            }

            // ✅ Check if already checked in
            const checkIn = new Date(data['Check In Date']);
            checkIn.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (today >= checkIn) {
                setError('Cancellation is not allowed after check-in date.');
                return;
            }

            const booking = {
                booking_id: data['Booking_id'],
                guest_name: data['Guest Name'],
                email: data['Email'],
                phone: data['Phone Number'],
                check_in_date: data['Check In Date'],
                check_out_date: data['Check Out Date'],
                total_amount: data['Total Amount'] || data['Amount'],
                payment_id: data['Payment ID'] || data['payment_id'],
                status: data['Status'],
            };

            const refund = calculateRefund(booking.check_in_date, booking.total_amount);

            setBookingInfo(booking);
            setRefundInfo(refund);

        } catch (err) {
            setError('Failed to fetch booking. Please try again or contact support.');
        } finally {
            setVerifying(false);
        }
    };

    // ── Step 2: Confirm & Cancel ───────────────────────────────────
    const handleCancel = async () => {
        if (!bookingInfo || !refundInfo) return;

        const confirmHtml = `
            <div style="text-align:left; font-size:14px; line-height:1.8;">
                <p><b>Booking ID:</b> ${bookingInfo.booking_id}</p>
                <p><b>Guest:</b> ${bookingInfo.guest_name}</p>
                <p><b>Check-in:</b> ${bookingInfo.check_in_date}</p>
                <p><b>Check-out:</b> ${bookingInfo.check_out_date}</p>
                <hr style="margin:12px 0; border:none; border-top:1px solid #eee;"/>
                <p><b>Amount Paid:</b> ₹${bookingInfo.total_amount}</p>
                <p><b>Refund Amount:</b> 
                    <span style="color:${refundInfo.eligible ? '#1f6f43' : '#dc2626'}; font-weight:bold;">
                        ${refundInfo.eligible ? `₹${refundInfo.refundAmount} (${refundInfo.refundPercent}%)` : 'No Refund'}
                    </span>
                </p>
                <p style="margin-top:8px; font-size:12px; color:#888;">
                    ${refundInfo.policy}
                </p>
                ${refundInfo.eligible
                    ? `<p style="font-size:12px; color:#555; margin-top:6px;">
                        Refund will be processed within <b>5–7 business days</b> 
                        to your original payment method.
                       </p>`
                    : `<p style="font-size:12px; color:#dc2626; margin-top:6px;">
                        ⚠️ You are not eligible for a refund based on our cancellation policy.
                       </p>`
                }
            </div>
        `;

        const confirm = await Swal.fire({
            title: 'Confirm Cancellation',
            html: confirmHtml,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: '🚫 Yes, Cancel Booking',
            cancelButtonText: 'Go Back',
            width: '480px',
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_N8N_URL}/cancel-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: bookingInfo.booking_id,
                    guest_name: bookingInfo.guest_name,
                    email: bookingInfo.email,
                    phone: bookingInfo.phone,
                    check_in_date: bookingInfo.check_in_date,
                    check_out_date: bookingInfo.check_out_date,
                    total_amount: bookingInfo.total_amount,
                    payment_id: bookingInfo.payment_id,
                    refund_amount: refundInfo.refundAmount,
                    refund_percent: refundInfo.refundPercent,
                    refund_eligible: refundInfo.eligible,
                    action: 'cancel',
                    source: 'website',
                    timestamp: new Date().toISOString()
                })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                Swal.fire({
                    title: '✅ Booking Cancelled',
                    html: `
                        <div style="font-size:14px; line-height:1.9; text-align:left;">
                            <p>Your booking <b>${bookingInfo.booking_id}</b> has been successfully cancelled.</p>
                            ${refundInfo.eligible
                                ? `<p>💰 <b>Refund of ₹${refundInfo.refundAmount}</b> will be credited to your original payment method within <b>5–7 business days</b>.</p>`
                                : `<p>❌ No refund applicable as per our cancellation policy.</p>`
                            }
                            <p style="color:#888; font-size:12px;">A confirmation email has been sent to <b>${bookingInfo.email}</b>.</p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonColor: '#1f6f43',
                });
                setBookingId('');
                setBookingInfo(null);
                setRefundInfo(null);

            } else if (data.status === 'exist') {
                Swal.fire('Already Cancelled', data.message || 'This booking has already been cancelled.', 'warning');
                setBookingInfo(null);
                setRefundInfo(null);
            } else {
                throw new Error(data.message || 'Cancellation failed');
            }

        } catch (err) {
            Swal.fire('Cancellation Failed', err.message || 'Something went wrong. Please contact support.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────
    return (
        <div className="container" style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
            <div className="glass-card" style={{ padding: '36px' }}>

                <h2 className="text-center mb-2">Cancel Your Booking</h2>
                <p className="text-center" style={{ color: '#666', marginBottom: '28px', fontSize: '14px' }}>
                    Enter your Booking ID to check refund eligibility and cancel your reservation.
                </p>

                {/* ── Policy ── */}
                <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    marginBottom: '24px'
                }}>
                    <h5 style={{ color: '#92400e', marginBottom: '12px' }}>📜 Cancellation Policy</h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: '#78350f', lineHeight: '2' }}>
                        <li>✅ <strong>4+ days before check-in</strong> — 100% refund</li>
                        <li>⚠️ <strong>Within 4 days of check-in</strong> — 50% refund</li>
                        <li>❌ <strong>Same day / No show</strong> — No refund</li>
                    </ul>
                </div>

                {/* ── Booking ID Input ── */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                        Enter Booking ID
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="e.g. KH-20250215-8XK2Q"
                            value={bookingId}
                            onChange={(e) => {
                                setBookingId(e.target.value.toUpperCase());
                                setError('');
                                setBookingInfo(null);
                                setRefundInfo(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px',
                                letterSpacing: '1px',
                                fontFamily: 'monospace'
                            }}
                        />
                        <button
                            onClick={handleVerify}
                            disabled={verifying}
                            className="btn btn-primary"
                            style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}
                        >
                            {verifying ? '⏳ Checking...' : '🔍 Verify'}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            marginTop: '10px',
                            background: '#fff5f5',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            color: '#dc2626',
                            fontSize: '13px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* ── Booking Info Card (after verify) ── */}
                {bookingInfo && refundInfo && (
                    <div style={{
                        background: '#f8fafb',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginTop: '24px'
                    }}>
                        {/* Card Header */}
                        <div style={{
                            background: '#1f6f43',
                            padding: '14px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                                📋 Booking Found
                            </span>
                            <span style={{
                                background: '#fff',
                                color: '#1f6f43',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                padding: '3px 10px',
                                borderRadius: '12px'
                            }}>
                                {bookingInfo.booking_id}
                            </span>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: '20px' }}>

                            {/* Guest Details */}
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                {[
                                    ['👤 Guest', bookingInfo.guest_name],
                                    ['📧 Email', bookingInfo.email],
                                    ['📱 Phone', bookingInfo.phone],
                                    ['📅 Check-in', bookingInfo.check_in_date],
                                    ['📅 Check-out', bookingInfo.check_out_date],
                                    ['💳 Amount Paid', `₹${bookingInfo.total_amount}`],
                                ].map(([label, value], i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '8px 4px', color: '#888', width: '40%' }}>{label}</td>
                                        <td style={{ padding: '8px 4px', fontWeight: '600', color: '#222' }}>{value}</td>
                                    </tr>
                                ))}
                            </table>

                            {/* Refund Eligibility Box */}
                            <div style={{
                                marginTop: '20px',
                                background: refundInfo.eligible ? '#f0faf4' : '#fff5f5',
                                border: `1px solid ${refundInfo.eligible ? '#d4edda' : '#fecaca'}`,
                                borderRadius: '10px',
                                padding: '16px 18px',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '10px'
                                }}>
                                    <span style={{
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        color: refundInfo.eligible ? '#1f6f43' : '#dc2626'
                                    }}>
                                        {refundInfo.eligible ? '✅ Refund Eligible' : '❌ Not Eligible for Refund'}
                                    </span>
                                    <span style={{
                                        background: refundInfo.eligible ? '#1f6f43' : '#dc2626',
                                        color: '#fff',
                                        borderRadius: '20px',
                                        padding: '4px 14px',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}>
                                        {refundInfo.refundPercent}% Refund
                                    </span>
                                </div>

                                <table style={{ width: '100%', fontSize: '13px', color: '#444' }}>
                                    <tr>
                                        <td style={{ padding: '4px 0', color: '#666' }}>Days until check-in</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{refundInfo.daysLeft} days</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 0', color: '#666' }}>Amount Paid</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{bookingInfo.total_amount}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 0', color: '#666' }}>Cancellation Charge</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>
                                            - ₹{bookingInfo.total_amount - refundInfo.refundAmount}
                                        </td>
                                    </tr>
                                    <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 0 4px 0', fontWeight: 'bold', fontSize: '15px' }}>
                                            Refund Amount
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            fontWeight: 'bold',
                                            fontSize: '18px',
                                            color: refundInfo.eligible ? '#1f6f43' : '#dc2626',
                                            padding: '10px 0 4px 0'
                                        }}>
                                            ₹{refundInfo.refundAmount}
                                        </td>
                                    </tr>
                                </table>

                                <p style={{
                                    margin: '10px 0 0 0',
                                    fontSize: '12px',
                                    color: '#888',
                                    lineHeight: '1.5'
                                }}>
                                    {refundInfo.policy}
                                    {refundInfo.eligible && ' • Processed within 5–7 business days'}
                                </p>
                            </div>

                            {/* Cancel Button */}
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    marginTop: '20px',
                                    padding: '13px',
                                    background: loading ? '#9ca3af' : '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '15px',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                {loading ? '⏳ Processing Cancellation...' : '🚫 Confirm Cancellation'}
                            </button>

                            <p style={{
                                textAlign: 'center',
                                fontSize: '12px',
                                color: '#aaa',
                                marginTop: '10px'
                            }}>
                                Once cancelled, this booking cannot be restored.
                            </p>

                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}