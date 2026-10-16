import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FileText, CheckCircle2, AlertTriangle, XCircle, Clock, User, Mail, Phone, Calendar, CreditCard, Search } from 'lucide-react';
import API_URL from '../config';

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
    const { booking_id: routeBookingId } = useParams();
    const [searchParams] = useSearchParams();
    const queryBookingId = searchParams.get('booking_id') || searchParams.get('bookingId') || routeBookingId || '';

    const [bookingId, setBookingId] = useState(queryBookingId);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [bookingInfo, setBookingInfo] = useState(null);
    const [refundInfo, setRefundInfo] = useState(null);
    const [error, setError] = useState('');

    // ── Step 1: Verify Booking ID ──────────────────────────────────
    const verifyBooking = async (idToVerify) => {
        const targetId = (idToVerify || bookingId || '').trim().toUpperCase();
        setError('');
        setBookingInfo(null);
        setRefundInfo(null);

        if (!targetId) {
            setError('Please enter your Booking ID');
            return;
        }

        const idPattern = /^KH-\d{8}-[A-Z0-9]{5}$/;
        if (!idPattern.test(targetId)) {
            setError('Invalid Booking ID format. Example: KH-20250215-8XK2Q');
            return;
        }

        const verifiedId = targetId;
        setVerifying(true);

        try {
            let res = await fetch(`${API_URL}/api/booking-cancellation?booking_id=${verifiedId}`);
            if (!res.ok) {
                res = await fetch(`${API_URL}/api/bookings/${verifiedId}`);
            }
            const result = await res.json().catch(() => null);

            if (!result || !result.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Not Found',
                    text: result?.error || 'Booking ID not found. Please check and try again.',
                    confirmButtonColor: '#3399cc',
                });
                return;
            }

            let data = result.data || result.booking || {};

            // Extract email and phone with case-insensitive / legacy property fallbacks
            let email = (data.email || data['Email'] || data['Guest Email'] || '').trim();
            let phone = (data.phone || data['Phone Number'] || data['Phone'] || '').trim();

            // If email or phone is missing, fetch full details from booking-enquiry or /bookings/:id
            if (!email || !phone) {
                try {
                    const enqRes = await fetch(`${API_URL}/api/booking-enquiry?booking_id=${verifiedId}`);
                    const enqResult = await enqRes.json().catch(() => null);
                    if (enqResult?.success && enqResult?.data) {
                        const ed = enqResult.data;
                        if (!email) email = (ed.email || ed['Email'] || ed['Guest Email'] || '').trim();
                        if (!phone) phone = (ed.phone || ed['Phone Number'] || ed['Phone'] || '').trim();
                        data = { ...ed, ...data };
                    }
                } catch (e) {
                    console.warn('Fallback enquiry fetch failed:', e);
                }

                if (!email || !phone) {
                    try {
                        const bRes = await fetch(`${API_URL}/api/bookings/${verifiedId}`);
                        const bResult = await bRes.json().catch(() => null);
                        const bd = bResult?.booking || bResult?.data;
                        if (bd) {
                            if (!email) email = (bd.email || bd['Email'] || '').trim();
                            if (!phone) phone = (bd.phone || bd['Phone Number'] || '').trim();
                            data = { ...bd, ...data };
                        }
                    } catch (e) {
                        console.warn('Fallback bookings fetch failed:', e);
                    }
                }
            }

            // Check if already cancelled
            const bookingStatus = (data['Status'] || data.status || '').toLowerCase();
            if (bookingStatus === 'cancelled') {
                setError('This booking has already been cancelled.');
                return;
            }

            // Check if already checked in
            const checkInDateStr = data['Check In Date'] || data.check_in_date;
            if (!checkInDateStr) {
                setError('Could not retrieve check-in date for this booking.');
                return;
            }

            const checkIn = new Date(checkInDateStr);
            checkIn.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (today >= checkIn) {
                setError('Cancellation is not allowed after check-in date.');
                return;
            }

            const booking = {
                booking_id: verifiedId,
                guest_name: (data['Guest Name'] || data.guest_name || 'Guest').trim(),
                email: email,
                phone: phone,
                check_in_date: checkInDateStr,
                check_out_date: data['Check Out Date'] || data.check_out_date,
                total_amount: Number(data['Total Amount'] || data.total_amount || data['Amount'] || 0),
                payment_id: data['Payment ID'] || data.payment_id || '',
                status: bookingStatus,
            };

            const refund = calculateRefund(booking.check_in_date, booking.total_amount);

            setBookingInfo(booking);
            setRefundInfo(refund);

        } catch (err) {
            console.error('Error verifying booking:', err);
            setError('Failed to fetch booking. Please try again or contact support.');
        } finally {
            setVerifying(false);
        }
    };

    const handleVerify = () => verifyBooking(bookingId);

    useEffect(() => {
        if (queryBookingId) {
            setBookingId(queryBookingId);
            verifyBooking(queryBookingId);
        }
    }, [queryBookingId]);

    // ── Step 2: Confirm & Cancel ───────────────────────────────────
    const handleCancel = async () => {
        if (!bookingInfo || !refundInfo) return;

        const currentBookingId = bookingInfo.booking_id || bookingId.trim().toUpperCase();

        const confirmHtml = `
            <div style="text-align:left; font-size:14px; line-height:1.8;">
                <p><b>Booking ID:</b> ${currentBookingId}</p>
                <p><b>Guest:</b> ${bookingInfo.guest_name || 'Guest'}</p>
                <p><b>Email:</b> ${bookingInfo.email || '—'}</p>
                <p><b>Phone:</b> ${bookingInfo.phone || '—'}</p>
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
                        You are not eligible for a refund based on our cancellation policy.
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
            confirmButtonText: 'Yes, Cancel Booking',
            cancelButtonText: 'Go Back',
            width: '480px',
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/cancel-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: currentBookingId,
                    bookingId: currentBookingId,
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
                    reason: 'Cancelled by guest via website',
                    source: 'website',
                    timestamp: new Date().toISOString()
                })
            });

            const resData = await res.json().catch(() => ({}));

            if (res.ok && resData.success && resData.status !== 'exist') {
                Swal.fire({
                    title: 'Booking Cancelled',
                    html: `
                        <div style="font-size:14px; line-height:1.9; text-align:left;">
                            <p>Your booking <b>${bookingInfo.booking_id}</b> has been successfully cancelled.</p>
                            ${refundInfo.eligible
                                ? `<p><b>Refund of ₹${refundInfo.refundAmount}</b> will be credited to your original payment method within <b>5–7 business days</b>.</p>`
                                : `<p>No refund applicable as per our cancellation policy.</p>`
                            }
                            <p style="color:#888; font-size:12px;">A confirmation email has been sent to <b>${bookingInfo.email}</b> and the property manager.</p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonColor: '#1f6f43',
                });
                setBookingId('');
                setBookingInfo(null);
                setRefundInfo(null);

            } else if (resData.status === 'exist') {
                Swal.fire('Already Cancelled', resData.message || 'This booking has already been cancelled.', 'warning');
                setBookingInfo(null);
                setRefundInfo(null);
            } else {
                throw new Error(resData.message || resData.error || 'Cancellation failed');
            }

        } catch (err) {
            console.error('Error during cancellation:', err);
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
                    <h5 style={{ color: '#92400e', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="#92400e" />
                        Cancellation Policy
                    </h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: '#78350f', lineHeight: '2' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={15} color="#16a34a" /> <strong>4+ days before check-in</strong> — 100% refund
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={15} color="#d97706" /> <strong>Within 4 days of check-in</strong> — 50% refund
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <XCircle size={15} color="#dc2626" /> <strong>Same day / No show</strong> — No refund
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={15} color="#4b5563" /> Refunds processed within <strong>5–7 business days</strong>
                        </li>
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
                            style={{ whiteSpace: 'nowrap', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            {verifying ? 'Checking...' : <><Search size={15} /> Verify</>}
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
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                            <span>{error}</span>
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
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={16} color="#fff" />
                                Booking Found
                            </span>
                            <span style={{
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 'bold',
                                letterSpacing: '0.5px'
                            }}>
                                {bookingInfo.booking_id || bookingId.trim().toUpperCase()}
                            </span>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: '20px' }}>

                            {/* Guest Details */}
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {[
                                        { icon: <User size={15} color="#64748b" />, label: 'Guest', value: bookingInfo.guest_name || 'Guest' },
                                        { icon: <Mail size={15} color="#64748b" />, label: 'Email', value: bookingInfo.email || '—' },
                                        { icon: <Phone size={15} color="#64748b" />, label: 'Phone', value: bookingInfo.phone || '—' },
                                        { icon: <Calendar size={15} color="#64748b" />, label: 'Check-in', value: bookingInfo.check_in_date || '—' },
                                        { icon: <Calendar size={15} color="#64748b" />, label: 'Check-out', value: bookingInfo.check_out_date || '—' },
                                        { icon: <CreditCard size={15} color="#64748b" />, label: 'Amount Paid', value: `₹${bookingInfo.total_amount || 0}` },
                                    ].map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '8px 4px', color: '#64748b', width: '40%' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    {row.icon}
                                                    {row.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 4px', fontWeight: '600', color: '#222' }}>{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
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
                                        color: refundInfo.eligible ? '#1f6f43' : '#dc2626',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        {refundInfo.eligible ? (
                                            <>
                                                <CheckCircle2 size={16} color="#1f6f43" />
                                                Refund Eligible
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={16} color="#dc2626" />
                                                Not Eligible for Refund
                                            </>
                                        )}
                                    </span>
                                    <span style={{
                                        color: refundInfo.eligible ? '#1f6f43' : '#dc2626',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}>
                                        {refundInfo.refundPercent}% Refund
                                    </span>
                                </div>

                                <table style={{ width: '100%', fontSize: '13px', color: '#444' }}>
                                    <tbody>
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
                                    </tbody>
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
                                {loading ? 'Processing Cancellation...' : 'Confirm Cancellation'}
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