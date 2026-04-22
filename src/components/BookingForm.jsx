import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import API_URL from '../config';
import './BookingForm.css';
import { useParams } from 'react-router-dom';

const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) { resolve(true); return; }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// ── Room type logic ────────────────────────────────────────────────
// Backend guests_count convention (used by calendar API):
//   4  = remaining room booking (small group on a partial date)
//   5  = partial / excluding-one-room booking
//  11  = full villa booking
//
// Available room types based on group size:
//   3–7 adults, 0–6 children  → partial (₹5000) OR full (₹7000)
//   7–10 adults OR 4–7 children → full only (₹7000)
//   On a partial-booked date   → remaining (₹2000) only

const ROOM_PRICE = { remaining: 2000, partial: 5000, full: 7000 };

const COUNTRY_CODES = [
    { code: '+91',  label: '🇮🇳 +91'  },
    { code: '+1',   label: '🇺🇸 +1'   },
    { code: '+44',  label: '🇬🇧 +44'  },
];

// Keyed by adults → max children for the partial (excluding-one-room) option.
// These groups can choose either partial or full villa.
//   3 adults → max 6 children
//   4 adults → max 5 children
//   5 adults → max 4 children
//   6 adults → max 3 children
//   7 adults → max 0 children  (0 children only)
const PARTIAL_MAX_CHILDREN = { 3: 6, 4: 5, 5: 4, 6: 3, 7: 0 };

// Keyed by adults → max children for the full villa option.
// These groups get full villa only (children above the partial limit, or large adult groups).
//   7 adults  → max 7 children
//   8 adults  → max 6 children
//   9 adults  → max 5 children
//  10 adults  → max 4 children
const FULL_MAX_CHILDREN = { 7: 7, 8: 6, 9: 5, 10: 4 };

// Can the group choose partial (excluding one room)? Keyed by adults count.
const canSelectPartial = (adults, children) => {
    const max = PARTIAL_MAX_CHILDREN[adults];
    return max !== undefined && children <= max;
};

// Max children allowed for a given adult count (used to limit children input)
const getMaxChildren = (adults) => {
    const p = PARTIAL_MAX_CHILDREN[adults];
    const f = FULL_MAX_CHILDREN[adults];
    if (p !== undefined && f !== undefined) return Math.max(p, f);
    if (f !== undefined) return f;
    if (p !== undefined) return p;
    return 0;
};

// Max adults allowed for a given children count (used to limit adults input)
const getMaxAdults = (children) => {
    for (let a = 10; a >= 3; a--) {
        if (getMaxChildren(a) >= children) return a;
    }
    return 3;
};

// Convert old stored guests_count back to {adults, children, room_type} for booking-link reload
const legacyCountToFields = (count) => {
    const n = parseInt(count);
    if (n === 4)  return { adults: 3, children: 0, room_type: 'remaining' };
    if (n === 5)  return { adults: 5, children: 0, room_type: 'partial' };
    return             { adults: 7, children: 0, room_type: 'full' };
};

// ── CheckoutForm ───────────────────────────────────────────────────
const CheckoutForm = ({ bookingData, onPaymentSuccess, onCancel }) => {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    const roomLabel = bookingData.room_type === 'partial'   ? 'Excluding one room • ₹5,000/night'
        : bookingData.room_type === 'remaining' ? 'Remaining room • ₹2,000/night'
        : 'Full villa • ₹7,000/night';

    const handlePayment = async () => {
        setProcessing(true);
        setError(null);

        if (bookingData.total_amount <= 0) {
            setError("Invalid booking amount");
            setProcessing(false);
            return;
        }

        const resScript = await loadRazorpayScript();
        if (!resScript) {
            setError("Razorpay SDK failed to load");
            setProcessing(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/create-payment-intent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: bookingData.total_amount })
            });

            const data = await res.json();
            if (!data.order) throw new Error("Order not created");

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY,
                amount: data.order.amount,
                currency: "INR",
                name: "Krish Homestays",
                description: "Room Reservation",
                order_id: data.order.id,
                handler: async function (response) {
                    const verifyRes = await fetch(`${API_URL}/api/verify-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(response)
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        onPaymentSuccess('verified', {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            amount: data.order.amount,
                            currency: "INR",
                            gateway: "razorpay"
                        });
                    } else {
                        onPaymentSuccess('failed');
                    }
                },
                prefill: {
                    name: bookingData.guest_name,
                    email: bookingData.email,
                    contact: bookingData.phone, // already combined country_code + number
                },
                theme: { color: "#3399cc" }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch {
            setError("Payment failed. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="payment-form text-center">
            <div className='payment-details'>
                <h3>Secure Payment</h3>
                <b><p>Total : ₹{bookingData.total_amount}</p></b>
                <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                    {bookingData.adults} adults
                    {bookingData.children > 0 ? `, ${bookingData.children} children` : ''}
                    {' • '}{roomLabel}
                </p>
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="payment-actions">
                <button onClick={onCancel} className="btn btn-secondary">Back</button>
                <button onClick={handlePayment} disabled={processing} className="btn btn-primary">
                    {processing ? "Processing..." : `Pay ₹${bookingData.total_amount}`}
                </button>
            </div>
        </div>
    );
};

// ── BookingForm ────────────────────────────────────────────────────
const BookingForm = () => {
    const [dateRange, setDateRange] = useState(null);
    const [calendarData, setCalendarData] = useState({ bookedRanges: [], rules: {} });
    const [formData, setFormData] = useState({
        guest_name: '',
        email: '',
        country_code: '+91',
        phone: '',
        adults: 3,
        children: 0,
        room_type: 'full',
    });
    const [step, setStep] = useState('details');
    const [error, setError] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [confirmBookingId, setBookingId] = useState('');

    const { booking_id } = useParams();

    // ─── Fetch calendar data ───────────────────────────────────────
    useEffect(() => {
        fetch(`${API_URL}/api/calendar-data`)
            .then(res => res.json())
            .then(data => setCalendarData(data))
            .catch(err => console.error(err));
    }, []);

    // ─── Fetch booking from link ───────────────────────────────────
    useEffect(() => {
        if (!booking_id) return;
        const fetchBooking = async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_N8N_URL}/booking-enquiry?booking_id=${booking_id}`
                );
                const raw = await response.json();
                const data = Array.isArray(raw) ? raw[0] : raw;
                if (!data || !data['Booking_id']) return;

                const guestFields = legacyCountToFields(data['Guest Count'] || 11);
                setFormData({
                    guest_name: data['Guest Name'] || '',
                    email: data['Email'] || '',
                    phone: data['Phone Number'] || '',
                    ...guestFields,
                });

                if (data['Check In Date'] && data['Check Out Date']) {
                    setDateRange([new Date(data['Check In Date']), new Date(data['Check Out Date'])]);
                }
                setBookingId(data['Booking_id']);
            } catch (err) {
                console.error("Failed to load booking", err);
            }
        };
        fetchBooking();
    }, [booking_id]);

    // ─── Date helpers ──────────────────────────────────────────────
    // Get all bookedRanges covering a date
    const rangesOnDate = (date) => {
        return calendarData.bookedRanges.filter(range => {
            const start = new Date(range.start); start.setHours(0, 0, 0, 0);
            const end   = new Date(range.end);   end.setHours(0, 0, 0, 0);
            const d     = new Date(date);         d.setHours(0, 0, 0, 0);
            return d >= start && d < end;
        });
    };

    // Fully closed: full booking (count ≥ 6), admin-blocked, or both rooms taken (partial+remaining)
    const isDateFullyBooked = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (calendarData.rules[dateStr]?.status === 'blocked') return true;
        const on = rangesOnDate(date);
        const hasFull      = on.some(r => r.guests_count >= 6 || !r.guests_count);
        const hasPartial   = on.some(r => r.guests_count === 5);
        const hasRemaining = on.some(r => r.guests_count === 4);
        return hasFull || (hasPartial && hasRemaining);
    };

    // Partially available: a partial (count=5) booking exists but the remaining room is still free
    const isDatePartiallyBooked = (date) => {
        const on = rangesOnDate(date);
        return on.some(r => r.guests_count === 5) && !on.some(r => r.guests_count === 4);
    };

    // True if ANY date in range has a partial booking still available for the remaining room
    const doesRangeHavePartial = (start, end) => {
        if (!start || !end) return false;
        let current = new Date(start); current.setHours(0, 0, 0, 0);
        const endDate = new Date(end); endDate.setHours(0, 0, 0, 0);
        while (current < endDate) {
            if (isDatePartiallyBooked(current)) return true;
            current.setDate(current.getDate() + 1);
        }
        return false;
    };

    // roomTypeOverride lets us check conflict before state updates settle
    const isDateUnavailable = (date, roomTypeOverride) => {
        const rt = roomTypeOverride !== undefined ? roomTypeOverride : formData.room_type;
        const dateStr = format(date, 'yyyy-MM-dd');
        if (calendarData.rules[dateStr]?.status === 'blocked') return true;

        const on = rangesOnDate(date);
        if (on.length === 0) return false;

        if (rt === 'remaining') {
            // Remaining room is only available when there's a partial booking (count=5)
            // and no prior remaining booking (count=4)
            const hasPartial   = on.some(r => r.guests_count === 5);
            const hasRemaining = on.some(r => r.guests_count === 4);
            const hasFull      = on.some(r => r.guests_count >= 6 || !r.guests_count);
            return hasFull || hasRemaining || !hasPartial;
        }

        // partial or full: blocked by any existing booking
        return true;
    };

    const isRangeUnavailable = (start, end, roomTypeOverride) => {
        if (!start || !end) return false;
        let current = new Date(start);
        const endDate = new Date(end);
        while (current < endDate) {
            if (isDateUnavailable(current, roomTypeOverride)) return true;
            current.setDate(current.getDate() + 1);
        }
        return false;
    };

    // Derived — no state needed, recomputed on every relevant change
    const dateConflict = !!(dateRange?.[0] && dateRange?.[1] &&
        isRangeUnavailable(dateRange[0], dateRange[1], formData.room_type));

    // ─── Pricing ───────────────────────────────────────────────────
    const getPriceForDate = (date) => {
        const customPrice = calendarData.rules[format(date, 'yyyy-MM-dd')]?.price;
        return customPrice || ROOM_PRICE[formData.room_type] || 7000;
    };

    const calculateTotal = () => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return 0;
        let total = 0;
        let current = new Date(dateRange[0]); current.setHours(0, 0, 0, 0);
        const end = new Date(dateRange[1]); end.setHours(0, 0, 0, 0);
        while (current < end) {
            total += getPriceForDate(current);
            current.setDate(current.getDate() + 1);
        }
        return total;
    };

    // ─── Validation ────────────────────────────────────────────────
    const isValidName  = (name)  => /^[A-Za-z\s]{3,}$/.test(name);
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone) => /^\d{6,15}$/.test(phone.replace(/[\s\-()]/g, ''));

    const generateBookingId = () => {
        if (!dateRange || !dateRange[0]) return "KH-INVALID";
        const d = new Date(dateRange[0]);
        const yyyyMMdd = d.toISOString().slice(0, 10).replace(/-/g, '');
        const unique = (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)).toUpperCase();
        return `KH-${yyyyMMdd}-${unique.slice(-5)}`;
    };

    // ─── Handlers ──────────────────────────────────────────────────
    const handleDateChange = (range) => {
        setDateRange(range);
        setError('');
        if (range && range[0] && range[1]) {
            const hasPartial = doesRangeHavePartial(range[0], range[1]);
            const newRoomType = hasPartial ? 'remaining'
                : (formData.room_type === 'remaining' ? 'full' : formData.room_type);
            setFormData(prev => ({ ...prev, room_type: newRoomType }));
        } else {
            setFormData(prev => ({
                ...prev,
                room_type: prev.room_type === 'remaining' ? 'full' : prev.room_type
            }));
        }
    };

    const handleAdultsChange = (e) => {
        const val = Math.min(10, Math.max(3, parseInt(e.target.value) || 3));
        setFormData(prev => {
            const clampedChildren = Math.min(prev.children, getMaxChildren(val));
            const newRoomType = !canSelectPartial(val, clampedChildren) && prev.room_type === 'partial'
                ? 'full' : prev.room_type;
            return { ...prev, adults: val, children: clampedChildren, room_type: newRoomType };
        });
    };

    const handleChildrenChange = (e) => {
        const val = Math.min(7, Math.max(0, parseInt(e.target.value) || 0));
        setFormData(prev => {
            const clampedAdults = Math.min(prev.adults, getMaxAdults(val));
            const newRoomType = !canSelectPartial(clampedAdults, val) && prev.room_type === 'partial'
                ? 'full' : prev.room_type;
            return { ...prev, children: val, adults: clampedAdults, room_type: newRoomType };
        });
    };

    const handleRoomTypeChange = (e) => {
        setFormData(prev => ({ ...prev, room_type: e.target.value }));
    };

    const handleDetailsSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (dateConflict) {
            setError('Selected dates are booked or blocked. Please choose different dates.');
            return;
        }
        if (!isValidName(formData.guest_name)) {
            setError('Please enter a valid full name (letters only, min 3 characters)');
            return;
        }
        if (!isValidEmail(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }
        if (!isValidPhone(formData.phone)) {
            setError('Please enter a valid phone number (digits only, 6–15 digits)');
            return;
        }
        if (!dateRange || !dateRange[0] || !dateRange[1]) {
            setError('Please select check-in and check-out dates');
            return;
        }
        if (formData.adults < 3) {
            setError('Minimum 3 adults required');
            return;
        }

        const checkIn  = dateRange[0];
        const checkOut = dateRange[1];
        const nights   = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        if (nights < 1) { setError('Minimum stay is 1 night'); return; }

        const conflict = isRangeUnavailable(checkIn, checkOut, formData.room_type);
        if (conflict) {
            setError('Selected dates are booked or blocked. Please choose different dates.');
            return;
        }

        const newBookingId = confirmBookingId || generateBookingId();
        if (!confirmBookingId) setBookingId(newBookingId);

        const guests_count = formData.adults + formData.children;

        if (!booking_id) {
            fetch(`${import.meta.env.VITE_N8N_URL}/registeration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: newBookingId,
                    guest_name: formData.guest_name,
                    email: formData.email,
                    phone: formData.country_code + formData.phone,
                    adults: formData.adults,
                    children: formData.children,
                    room_type: formData.room_type,
                    room_label: formData.room_type === 'full' ? 'full villa'
                        : formData.room_type === 'partial' ? 'half villa'
                        : 'Remaining Room',
                    guests_count,
                    check_in_date: format(checkIn, 'yyyy-MM-dd'),
                    check_out_date: format(checkOut, 'yyyy-MM-dd'),
                    source: 'website',
                    timestamp: new Date().toISOString(),
                    payment: { status: 'enquiry' }
                })
            }).catch(err => console.error('Enquiry webhook failed', err));
        }

        setStep('payment');
    };

    const handlePaymentSuccess = async (status, paymentDetails = {}) => {
        const checkIn     = dateRange[0];
        const checkOut    = dateRange[1];
        const totalAmount = calculateTotal();
        const bookingId   = confirmBookingId;

        const guests_count = formData.adults + formData.children;

        const bookingPayload = {
            booking_id: bookingId,
            guest_name: formData.guest_name,
            email: formData.email,
            phone: formData.country_code + formData.phone,
            adults: formData.adults,
            children: formData.children,
            room_type: formData.room_type,
            room_label: formData.room_type === 'full' ? 'Full Villa'
                : formData.room_type === 'partial' ? 'Excluding One Room'
                : 'Remaining Room',
            guests_count,
            check_in_date:  format(checkIn,  'yyyy-MM-dd'),
            check_out_date: format(checkOut, 'yyyy-MM-dd'),
            total_amount: totalAmount
        };

        const webhookPayload = {
            booking: bookingPayload,
            payment: {
                status:     status === 'verified' ? 'booked' : 'failed',
                booking_id: bookingId,
                payment_id: paymentDetails?.razorpay_payment_id || null,
                order_id:   paymentDetails?.razorpay_order_id   || null,
                signature:  paymentDetails?.razorpay_signature  || null,
                amount:     paymentDetails?.amount || totalAmount,
                currency:   paymentDetails?.currency || 'INR',
                gateway:    'razorpay'
            },
            meta: { source: 'website', timestamp: new Date().toISOString() }
        };

        try {
            fetch(`${import.meta.env.VITE_N8N_URL}/registeration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            }).catch(err => console.error('n8n webhook failed', err));

            if (status === 'failed') {
                setPaymentStatus('failed');
                setError('Payment failed. We will remind you shortly.');
                return;
            }

            generateReceiptAndNotify(webhookPayload);
            setPaymentStatus('success');
            setStep('success');

        } catch (err) {
            setPaymentStatus('failed');
            setError(err.message);
        }
    };

    const generateReceiptAndNotify = async (webhookPayload) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/send-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
            });
        } catch (err) {
            console.error('Receipt flow failed', err);
        }
    };

    // ─── Render helpers ────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div className="glass-card text-center section" style={{ padding: '50px' }}>
                <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
                <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>Booking Confirmed!</h2>
                <p>Thank you, <strong>{formData.guest_name}</strong>.</p>
                <p>We have sent a confirmation to <strong>{formData.email}</strong>.</p>
                <button className="btn btn-primary mt-4" onClick={() => window.location.href = '/book'}>
                    Book Another Stay
                </button>
            </div>
        );
    }

    const nights = (() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return 0;
        const s = new Date(dateRange[0]); s.setHours(0, 0, 0, 0);
        const e = new Date(dateRange[1]); e.setHours(0, 0, 0, 0);
        return Math.round((e - s) / (1000 * 60 * 60 * 24));
    })();

    const totalAmount   = calculateTotal();
    const pricePerNight = getPriceForDate(dateRange?.[0] || new Date());

    const datesSelected = dateRange && dateRange[0] && dateRange[1];
    const rangeHasPartial = datesSelected && doesRangeHavePartial(dateRange[0], dateRange[1]);
    const partialAllowed  = canSelectPartial(formData.adults, formData.children);

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        if (isDateFullyBooked(date)) return null;
        const partial  = isDatePartiallyBooked(date);
        const customPrice = calendarData.rules[format(date, 'yyyy-MM-dd')]?.price;
        return (
            <div style={{ fontSize: '10px', marginTop: '2px' }}>
                {partial
                    ? <span style={{ color: '#e67e22' }}>Partial</span>
                    : <span style={{ color: '#888' }}>₹{customPrice || ROOM_PRICE[formData.room_type] || 7000}</span>
                }
            </div>
        );
    };

    const getTileClassName = ({ date, view }) => {
        if (view !== 'month') return null;
        if (isDatePartiallyBooked(date)) return 'partially-booked';
        return null;
    };

    const renderRoomOptions = () => {
        const infoStyle = {
            background: '#f0faf4', border: '1px solid #d4edda',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#1f6f43'
        };

        if (rangeHasPartial) {
            return (
                <div className="form-group">
                    <label>Room Option</label>
                    <select value="remaining" disabled style={{ opacity: 0.8 }}>
                        <option value="remaining">Remaining room — ₹2,000/night</option>
                    </select>
                    <div style={{ ...infoStyle, marginTop: '8px' }}>
                        This date has a partial booking. Only the remaining room is available.
                    </div>
                </div>
            );
        }

        if (partialAllowed) {
            return (
                <div className="form-group">
                    <label>Room Option</label>
                    <select
                        value={formData.room_type}
                        onChange={handleRoomTypeChange}
                        disabled={!datesSelected}
                        style={{ opacity: datesSelected ? 1 : 0.5 }}
                    >
                        <option value="partial">Excluding one room — ₹5,000/night</option>
                        <option value="full">Full villa — ₹7,000/night</option>
                    </select>
                    {!datesSelected && (
                        <p style={{ fontSize: '12px', color: '#aaa', margin: '4px 0 0 0' }}>
                            Select dates first
                        </p>
                    )}
                </div>
            );
        }

        // Large group — full villa only
        return (
            <div className="form-group">
                <label>Room Option</label>
                <select value="full" disabled style={{ opacity: 0.8 }}>
                    <option value="full">Full villa — ₹7,000/night</option>
                </select>
                <div style={{ ...infoStyle, marginTop: '8px', color: '#555', background: '#f5f5f5', border: '1px solid #ddd' }}>
                    Your group size requires the full villa.
                </div>
            </div>
        );
    };

    return (
        <>
            {paymentStatus === 'verifying' && (
                <div className="overlay">
                    <div className="loader-box">
                        <div className="spinner"></div>
                        <p>Verifying payment... Please wait</p>
                    </div>
                </div>
            )}

            <div className="booking-container glass-card">
                <h1 className="text-center mb-4">Book Your Stay</h1>

                {step === 'details' ? (
                    <div className="booking-grid">

                        {/* ── Calendar ── */}
                        <div className="calendar-section">
                            <Calendar
                                selectRange={true}
                                onChange={handleDateChange}
                                value={dateRange}
                                tileDisabled={({ date }) => isDateFullyBooked(date)}
                                tileContent={getTileContent}
                                tileClassName={getTileClassName}
                                minDate={new Date()}
                                className="custom-calendar"
                            />

                            <div className="mt-4 text-center" style={{ fontWeight: '500', color: 'var(--primary)' }}>
                                {nights > 0
                                    ? `${format(dateRange[0], 'MMM dd')} – ${format(dateRange[1], 'MMM dd')} (${nights} night${nights > 1 ? 's' : ''})`
                                    : 'Select Check-in and Check-out dates'}
                            </div>

                            {dateConflict && (
                                <div style={{
                                    marginTop: '12px', background: '#fff3f3',
                                    border: '1px solid #ff4444', borderRadius: '8px',
                                    padding: '12px 16px', color: '#cc0000',
                                    fontWeight: '500', fontSize: '14px', textAlign: 'center'
                                }}>
                                    ⚠️ One or more selected dates are already booked or blocked.
                                    Please choose different dates.
                                </div>
                            )}
                        </div>

                        {/* ── Form ── */}
                        <form onSubmit={handleDetailsSubmit} className="form-section">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={formData.guest_name}
                                    onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone / WhatsApp</label>
                                <div className="phone-input-group">
                                    <select
                                        className="phone-country-select"
                                        value={formData.country_code}
                                        onChange={e => setFormData({ ...formData, country_code: e.target.value })}
                                    >
                                        {COUNTRY_CODES.map(c => (
                                            <option key={c.code} value={c.code}>{c.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        className="phone-number-input"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="98765 43210"
                                    />
                                </div>
                            </div>

                            {/* ── Guest Count ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label>Adults <span style={{ color: '#aaa', fontWeight: 400 }}>(3–{getMaxAdults(formData.children)})</span></label>
                                    <input
                                        type="number"
                                        min={3} max={getMaxAdults(formData.children)}
                                        value={formData.adults}
                                        onChange={handleAdultsChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Children <span style={{ color: '#aaa', fontWeight: 400 }}>(0–{getMaxChildren(formData.adults)})</span></label>
                                    <input
                                        type="number"
                                        min={0} max={getMaxChildren(formData.adults)}
                                        value={formData.children}
                                        onChange={handleChildrenChange}
                                    />
                                </div>
                            </div>

                            {/* ── Room Option ── */}
                            {renderRoomOptions()}

                            {/* ── Total preview ── */}
                            {nights > 0 && !dateConflict && (
                                <div style={{
                                    background: 'var(--bg-light)', borderRadius: '8px',
                                    padding: '12px 16px', marginBottom: '16px', fontSize: '15px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>₹{pricePerNight} × {nights} night{nights > 1 ? 's' : ''}</span>
                                        <strong>₹{totalAmount}</strong>
                                    </div>
                                    {formData.room_type === 'partial' && (
                                        <p style={{ fontSize: '12px', color: '#888', margin: '6px 0 0 0' }}>
                                            ℹ️ Excluding one room — remaining room may still be booked by others
                                        </p>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="error-message" style={{ marginBottom: '12px' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{
                                    width: '100%', fontSize: '1.1rem',
                                    opacity: dateConflict ? 0.5 : 1,
                                    cursor: dateConflict ? 'not-allowed' : 'pointer'
                                }}
                                disabled={dateConflict}
                            >
                                {dateConflict ? '🚫 Dates Unavailable' : 'Proceed to Payment'}
                            </button>

                            <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '10px' }}>
                                🔒 Secured by Razorpay
                            </p>
                        </form>
                    </div>
                ) : (
                    <div className="payment-section">
                        <CheckoutForm
                            bookingData={{ ...formData, phone: formData.country_code + formData.phone, total_amount: totalAmount }}
                            onPaymentSuccess={handlePaymentSuccess}
                            onCancel={() => setStep("details")}
                            paymentStatus={paymentStatus}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default BookingForm;
