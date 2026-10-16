import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, Info, Lock } from 'lucide-react';
import API_URL from '../config';
import './BookingForm.css';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';

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
    { code: '+91',  label: '+91 (IN)' },
    { code: '+1',   label: '+1 (US)'  },
    { code: '+44',  label: '+44 (UK)' },
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

// Booking type helpers — check booking_type or room_type field first, fall back to guests_count
const isPartialType = (t) => {
    if (!t) return false;
    const s = String(t).toLowerCase();
    return s.includes('half') || s.includes('partial');
};

const isRemainingType = (t) => {
    if (!t) return false;
    const s = String(t).toLowerCase();
    return s.includes('remaining');
};

const isFullType = (t) => {
    if (!t) return true;
    const s = String(t).toLowerCase();
    return s.includes('full') || (!isPartialType(s) && !isRemainingType(s));
};

const isFullBooking = (r) => {
    const t = r.booking_type || r.room_type;
    if (t) return isFullType(t);
    return r.guests_count >= 6 || !r.guests_count;
};
const isPartialBooking = (r) => {
    const t = r.booking_type || r.room_type;
    if (t) return isPartialType(t);
    return r.guests_count === 5;
};
const isRemainingBooking = (r) => {
    const t = r.booking_type || r.room_type;
    if (t) return isRemainingType(t);
    return r.guests_count === 4;
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

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${res.status}`);
            }

            const data = await res.json();
            if (!data.order) throw new Error(data.error || "Order not created");

            const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY;
            if (!razorpayKey) {
                throw new Error("Razorpay Key is missing in client environment (VITE_RAZORPAY_KEY)");
            }

            const options = {
                key: razorpayKey,
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
                            amount: data.order.amount / 100,
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
            rzp.on('payment.failed', function (response) {
                console.error("Razorpay payment failed:", response.error);
                setError(response.error.description || "Payment failed");
            });
            rzp.open();

        } catch (err) {
            console.error("Payment initiation failed:", err);
            setError(err.message || "Payment failed. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="payment-form text-center">
            <div className='payment-details'>
                <h3>Secure Payment</h3>
                <b><p>Total : ₹{bookingData.total_amount}</p></b>
                <p style={{ fontSize: '13px', color: '#888', marginTop: '4px', wordWrap: 'break-word', whiteSpace: 'normal', padding: '0 10px' }}>
                    {bookingData.adults} adults
                    {bookingData.children > 0 ? `, ${bookingData.children} children` : ''}
                    {' • '}{roomLabel}
                </p>
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="payment-actions" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
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

    const checkInDate = Array.isArray(dateRange) ? dateRange[0] : (dateRange instanceof Date ? dateRange : null);
    const checkOutDate = Array.isArray(dateRange) && dateRange[1] ? dateRange[1] : null;
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
                    `${API_URL}/api/booking-enquiry?booking_id=${booking_id}`
                );

                const data1 = await response.json();

                if (!data1.success) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: data1.error || 'Booking data not found or invalid.',
                        confirmButtonColor: '#3399cc',
                    });
                    return;
                }

                const data = data1.data;

                const adults   = parseInt(data['Guest Adults'])   || 3;
                const children = parseInt(data['Guest Children']) || 0;
                const typeRaw  = (data['Booking Type'] || '').toLowerCase();
                const room_type = typeRaw.includes('half villa') || typeRaw.includes('partial')
                    ? 'partial'
                    : typeRaw.includes('remaining')
                    ? 'remaining'
                    : 'full';

                setFormData({
                    guest_name:   data['Guest Name']    || '',
                    email:        data['Email']         || '',
                    country_code: '+91',
                    phone:        String(data['Phone Number'] || ''),
                    adults,
                    children,
                    room_type,
                });

                if (data['Check In Date'] && data['Check Out Date']) {
                    setDateRange([new Date(data['Check In Date']), new Date(data['Check Out Date'])]);
                }

                setBookingId(data['Booking Id']);
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

    // Fully closed: full villa booking, admin-blocked, admin-booked, or both rooms taken (partial+remaining)
    const isDateFullyBooked = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules[dateStr];
        const ruleStatus = rule?.status;
        const ruleRoomType = rule?.room_type || '';

        // Admin hard-blocked
        if (ruleStatus === 'blocked') return true;

        const on = rangesOnDate(date);
        const hasFull = on.some(isFullBooking) || (ruleStatus === 'booked' && isFullType(ruleRoomType));
        if (hasFull) return true;

        const hasPartial = on.some(isPartialBooking) || (ruleStatus === 'booked' && isPartialType(ruleRoomType));
        const hasRemaining = on.some(isRemainingBooking) || (ruleStatus === 'booked' && isRemainingType(ruleRoomType));

        return hasPartial && hasRemaining;
    };

    // Partially available: a half villa booking exists but the remaining room is still free
    const isDatePartiallyBooked = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules[dateStr];
        const ruleStatus = rule?.status;
        const ruleRoomType = rule?.room_type || '';

        if (ruleStatus === 'blocked') return false;

        const on = rangesOnDate(date);
        const hasFull = on.some(isFullBooking) || (ruleStatus === 'booked' && isFullType(ruleRoomType));
        if (hasFull) return false;

        const hasRemaining = on.some(isRemainingBooking) || (ruleStatus === 'booked' && isRemainingType(ruleRoomType));
        if (hasRemaining) return false;

        const hasPartial = on.some(isPartialBooking) || (ruleStatus === 'booked' && isPartialType(ruleRoomType));
        return hasPartial;
    };

    // Remaining room status & extension rules:
    // If range overlaps with partial-booked dates, user can book remaining room.
    // Allowed extensions: at most 1 day earlier (check-in) and/or at most 1 day later (check-out),
    // provided those extension dates are open/available.
    const getRemainingRoomStatus = (start, end) => {
        if (!start || !end) return { isRemainingEligible: false, hasPartial: false };
        let s = new Date(start); s.setHours(0, 0, 0, 0);
        let e = new Date(end); e.setHours(0, 0, 0, 0);
        if (s >= e) return { isRemainingEligible: false, hasPartial: false };

        const dates = [];
        let curr = new Date(s);
        while (curr < e) {
            dates.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }

        const partialDates = dates.filter(d => isDatePartiallyBooked(d));
        if (partialDates.length === 0) {
            return { isRemainingEligible: false, hasPartial: false };
        }

        const minPartialTime = Math.min(...partialDates.map(d => d.getTime()));
        const maxPartialTime = Math.max(...partialDates.map(d => d.getTime()));
        const minPartialDate = new Date(minPartialTime);
        const maxPartialDate = new Date(maxPartialTime);

        // Gap check: all dates between earliest partial and latest partial date in selection must be partial dates
        let gapCheck = new Date(minPartialDate);
        while (gapCheck <= maxPartialDate) {
            if (!isDatePartiallyBooked(gapCheck)) {
                return { isRemainingEligible: false, hasPartial: true, invalidReason: 'gap' };
            }
            gapCheck.setDate(gapCheck.getDate() + 1);
        }

        // Limit extension to at most 1 day before minPartialDate and at most 1 day after maxPartialDate
        const daysBefore = Math.round((minPartialTime - s.getTime()) / (1000 * 60 * 60 * 24));
        const daysAfter = Math.round((e.getTime() - (maxPartialTime + 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24));

        if (daysBefore > 1 || daysAfter > 1 || daysBefore < 0 || daysAfter < 0) {
            return {
                isRemainingEligible: false,
                hasPartial: true,
                invalidReason: 'extension_exceeded',
                daysBefore,
                daysAfter
            };
        }

        // Verify that the extension days (if any) are not booked or blocked
        for (const d of dates) {
            if (!isDatePartiallyBooked(d)) {
                const dateStr = format(d, 'yyyy-MM-dd');
                const rule = calendarData.rules[dateStr];
                if (rule?.status === 'blocked' || rule?.status === 'booked' || rangesOnDate(d).length > 0) {
                    return { isRemainingEligible: false, hasPartial: true, invalidReason: 'extension_blocked' };
                }
            }
        }

        return {
            isRemainingEligible: true,
            hasPartial: true,
            extendedBefore: daysBefore === 1,
            extendedAfter: daysAfter === 1
        };
    };

    // True if ANY date in range has a partial booking still available for the remaining room
    const doesRangeHavePartial = (start, end) => {
        return getRemainingRoomStatus(start, end).hasPartial;
    };

    // roomTypeOverride lets us check conflict before state updates settle
    const isDateUnavailable = (date, roomTypeOverride) => {
        const rt = roomTypeOverride !== undefined ? roomTypeOverride : formData.room_type;
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules[dateStr];
        const ruleStatus = rule?.status;
        const ruleRoomType = rule?.room_type || '';

        // Hard block by admin
        if (ruleStatus === 'blocked') return true;

        const on = rangesOnDate(date);
        const hasFull = on.some(isFullBooking) || (ruleStatus === 'booked' && isFullType(ruleRoomType));
        const hasRemaining = on.some(isRemainingBooking) || (ruleStatus === 'booked' && isRemainingType(ruleRoomType));
        const hasPartial = on.some(isPartialBooking) || (ruleStatus === 'booked' && isPartialType(ruleRoomType));

        if (rt === 'remaining') {
            if (hasPartial) {
                return hasFull || hasRemaining;
            }
            return hasFull || hasRemaining || on.length > 0;
        }

        return hasFull || hasPartial || hasRemaining || ruleStatus === 'booked';
    };

    const isRangeUnavailable = (start, end, roomTypeOverride) => {
        if (!start || !end) return false;
        const rt = roomTypeOverride !== undefined ? roomTypeOverride : formData.room_type;
        const status = getRemainingRoomStatus(start, end);

        if (rt === 'remaining') {
            if (!status.isRemainingEligible) return true;
        } else {
            // Full or partial villa cannot be booked over existing partial dates
            if (status.hasPartial) return true;
        }

        let current = new Date(start); current.setHours(0, 0, 0, 0);
        const endDate = new Date(end); endDate.setHours(0, 0, 0, 0);
        while (current < endDate) {
            if (isDateUnavailable(current, rt)) return true;
            current.setDate(current.getDate() + 1);
        }
        return false;
    };

    // Derived — no state needed, recomputed on every relevant change
    const remainingStatus = checkInDate && checkOutDate ? getRemainingRoomStatus(checkInDate, checkOutDate) : null;
    const isRemaining = formData.room_type === 'remaining';

    const dateConflict = !!(checkInDate && checkOutDate &&
        isRangeUnavailable(checkInDate, checkOutDate, formData.room_type));

    // ─── Pricing ───────────────────────────────────────────────────
    const getPriceForDate = (date) => {
        if (formData.room_type === 'remaining') {
            return ROOM_PRICE.remaining; // ₹2000/night for remaining room
        }
        const customPrice = calendarData.rules[format(date, 'yyyy-MM-dd')]?.price;
        return customPrice || ROOM_PRICE[formData.room_type] || 7000;
    };

    const calculateTotal = () => {
        if (!checkInDate || !checkOutDate) return 0;
        let total = 0;
        let current = new Date(checkInDate); current.setHours(0, 0, 0, 0);
        const end = new Date(checkOutDate); end.setHours(0, 0, 0, 0);
        while (current < end) {
            total += getPriceForDate(current);
            current.setDate(current.getDate() + 1);
        }
        return total;
    };

    // ─── Validation ────────────────────────────────────────────────
    const isValidName  = (name)  => /^[A-Za-z\s]{3,}$/.test(name);
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const getPhoneConfig = (countryCode) => {
        switch (countryCode) {
            case '+91':
                return {
                    maxLength: 10,
                    placeholder: '98765 43210',
                    validate: (digits) => {
                        if (digits.length !== 10) return 'Indian phone number must be exactly 10 digits';
                        if (!/^[6-9]\d{9}$/.test(digits)) return 'Indian mobile numbers must start with 6, 7, 8, or 9';
                        return null;
                    }
                };
            case '+1':
                return {
                    maxLength: 10,
                    placeholder: '202 555 0123',
                    validate: (digits) => {
                        if (digits.length !== 10) return 'US/Canada phone number must be exactly 10 digits';
                        if (!/^[2-9]\d{9}$/.test(digits)) return 'US/Canada phone numbers must start with a digit between 2 and 9';
                        return null;
                    }
                };
            case '+44':
                return {
                    maxLength: 11,
                    placeholder: '7911 123456',
                    validate: (digits) => {
                        if (digits.length < 10 || digits.length > 11) return 'UK phone number must be 10 or 11 digits';
                        return null;
                    }
                };
            default:
                return {
                    maxLength: 15,
                    placeholder: '98765 43210',
                    validate: (digits) => {
                        if (digits.length < 8 || digits.length > 15) return 'Please enter a valid phone number (8–15 digits)';
                        return null;
                    }
                };
        }
    };

    const handlePhoneChange = (e) => {
        // Strip out all non-digit characters immediately
        const digits = e.target.value.replace(/\D/g, '');
        const config = getPhoneConfig(formData.country_code);
        setFormData(prev => ({ ...prev, phone: digits.slice(0, config.maxLength) }));
        if (error) setError('');
    };

    const handleCountryCodeChange = (e) => {
        const newCode = e.target.value;
        const config = getPhoneConfig(newCode);
        setFormData(prev => ({
            ...prev,
            country_code: newCode,
            phone: prev.phone.slice(0, config.maxLength)
        }));
        if (error) setError('');
    };

    const generateBookingId = () => {
        if (!checkInDate) return "KH-INVALID";
        const d = new Date(checkInDate);
        const yyyyMMdd = d.toISOString().slice(0, 10).replace(/-/g, '');
        const unique = (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)).toUpperCase();
        return `KH-${yyyyMMdd}-${unique.slice(-5)}`;
    };

    // ─── Handlers ──────────────────────────────────────────────────
    const handleDateChange = (range) => {
        setDateRange(range);
        setError('');
        const cIn = Array.isArray(range) ? range[0] : (range instanceof Date ? range : null);
        const cOut = Array.isArray(range) && range[1] ? range[1] : null;
        if (cIn && cOut) {
            const status = getRemainingRoomStatus(cIn, cOut);
            if (status.isRemainingEligible) {
                setFormData(prev => {
                    let newAdults = Number(prev.adults) || 2;
                    let newChildren = Number(prev.children) || 0;
                    if (newAdults > 3 || newAdults < 1) newAdults = 2;
                    if (newAdults + newChildren > 3) {
                        newChildren = Math.max(0, 3 - newAdults);
                    }
                    return {
                        ...prev,
                        room_type: 'remaining',
                        adults: newAdults,
                        children: newChildren
                    };
                });
            } else {
                setFormData(prev => {
                    let newAdults = Number(prev.adults) || 3;
                    if (newAdults < 3) newAdults = 3;
                    let newRoomType = prev.room_type === 'remaining' ? 'full' : prev.room_type;
                    if (newRoomType === 'partial' && !canSelectPartial(newAdults, prev.children)) {
                        newRoomType = 'full';
                    }
                    return {
                        ...prev,
                        room_type: newRoomType,
                        adults: newAdults
                    };
                });
            }
        }
    };

    const handleAdultsChange = (e) => {
        const raw = e.target.value;
        if (raw === '') {
            setFormData(prev => ({ ...prev, adults: '' }));
            return;
        }

        let num;
        if (raw.length > 1 && raw !== '10') {
            const lastDigit = parseInt(raw.slice(-1), 10);
            num = isNaN(lastDigit) ? (isRemaining ? 1 : 3) : lastDigit;
        } else {
            num = parseInt(raw, 10);
        }

        if (isRemaining) {
            const currentChildren = Number(formData.children) || 0;
            const max = Math.max(1, 3 - currentChildren);
            const val = Math.min(max, Math.max(1, isNaN(num) ? 1 : num));
            setFormData(prev => ({ ...prev, adults: val }));
        } else {
            const max = getMaxAdults(Number(formData.children) || 0);
            const val = Math.min(max, Math.max(1, isNaN(num) ? 3 : num));

            setFormData(prev => {
                const currentChildren = Number(prev.children) || 0;
                const clampedChildren = Math.min(currentChildren, getMaxChildren(val));
                const newRoomType = !canSelectPartial(val, clampedChildren) && prev.room_type === 'partial'
                    ? 'full' : prev.room_type;
                return { ...prev, adults: val, children: clampedChildren, room_type: newRoomType };
            });
        }
    };

    const handleAdultsBlur = () => {
        const val = parseInt(formData.adults, 10);
        if (isRemaining) {
            const currentChildren = Number(formData.children) || 0;
            const max = Math.max(1, 3 - currentChildren);
            const safeVal = isNaN(val) || val < 1 ? 1 : Math.min(max, val);
            setFormData(prev => ({ ...prev, adults: safeVal }));
        } else {
            const max = getMaxAdults(Number(formData.children) || 0);
            const safeVal = isNaN(val) || val < 3 ? 3 : Math.min(max, val);

            setFormData(prev => {
                const currentChildren = Number(prev.children) || 0;
                const clampedChildren = Math.min(currentChildren, getMaxChildren(safeVal));
                const newRoomType = !canSelectPartial(safeVal, clampedChildren) && prev.room_type === 'partial'
                    ? 'full' : prev.room_type;
                return { ...prev, adults: safeVal, children: clampedChildren, room_type: newRoomType };
            });
        }
    };

    const handleChildrenChange = (e) => {
        const raw = e.target.value;
        if (raw === '') {
            setFormData(prev => ({ ...prev, children: '' }));
            return;
        }

        let num;
        if (raw.length > 1) {
            const lastDigit = parseInt(raw.slice(-1), 10);
            num = isNaN(lastDigit) ? 0 : lastDigit;
        } else {
            num = parseInt(raw, 10);
        }

        if (isRemaining) {
            const currentAdults = Number(formData.adults) || 1;
            const max = Math.max(0, 3 - currentAdults);
            const val = Math.min(max, Math.max(0, isNaN(num) ? 0 : num));
            setFormData(prev => ({ ...prev, children: val }));
        } else {
            const currentAdults = Number(formData.adults) || 3;
            const max = getMaxChildren(currentAdults);
            const val = Math.min(max, Math.max(0, isNaN(num) ? 0 : num));

            setFormData(prev => {
                const clampedAdults = Math.min(Number(prev.adults) || 3, getMaxAdults(val));
                const newRoomType = !canSelectPartial(clampedAdults, val) && prev.room_type === 'partial'
                    ? 'full' : prev.room_type;
                return { ...prev, children: val, adults: clampedAdults, room_type: newRoomType };
            });
        }
    };

    const handleChildrenBlur = () => {
        const val = parseInt(formData.children, 10);
        if (isRemaining) {
            const currentAdults = Number(formData.adults) || 1;
            const max = Math.max(0, 3 - currentAdults);
            const safeVal = isNaN(val) || val < 0 ? 0 : Math.min(max, val);
            setFormData(prev => ({ ...prev, children: safeVal }));
        } else {
            const currentAdults = Number(formData.adults) || 3;
            const max = getMaxChildren(currentAdults);
            const safeVal = isNaN(val) || val < 0 ? 0 : Math.min(max, val);

            setFormData(prev => {
                const clampedAdults = Math.min(Number(prev.adults) || 3, getMaxAdults(safeVal));
                const newRoomType = !canSelectPartial(clampedAdults, safeVal) && prev.room_type === 'partial'
                    ? 'full' : prev.room_type;
                return { ...prev, children: safeVal, adults: clampedAdults, room_type: newRoomType };
            });
        }
    };

    const handleRoomTypeChange = (e) => {
        setFormData(prev => ({ ...prev, room_type: e.target.value }));
    };

    const handleDetailsSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!checkInDate) {
            setError('Please select both Check-in and Check-out dates on the calendar.');
            return;
        }

        if (!checkOutDate) {
            const formattedCheckIn = format(new Date(checkInDate), 'dd MMM yyyy');
            setError(`Check-in selected for ${formattedCheckIn}. Please select your Check-out date on the calendar before proceeding.`);
            return;
        }

        const startMidnight = new Date(checkInDate); startMidnight.setHours(0, 0, 0, 0);
        const endMidnight = new Date(checkOutDate); endMidnight.setHours(0, 0, 0, 0);
        const stayNights = Math.round((endMidnight - startMidnight) / (1000 * 60 * 60 * 24));

        if (stayNights < 1) {
            setError('Check-out date must be at least 1 day after check-in. Please select your Check-out date.');
            return;
        }

        const statusCheck = checkInDate && checkOutDate ? getRemainingRoomStatus(checkInDate, checkOutDate) : null;
        if (statusCheck?.hasPartial && !statusCheck.isRemainingEligible) {
            if (statusCheck.invalidReason === 'extension_exceeded') {
                setError('Remaining room can only be extended by at most 1 day earlier or 1 day later.');
                return;
            }
            if (statusCheck.invalidReason === 'extension_blocked') {
                setError('The extended check-in or check-out date is already booked or blocked.');
                return;
            }
        }

        if (dateConflict || isRangeUnavailable(checkInDate, checkOutDate, formData.room_type)) {
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

        const digitsOnly = (formData.phone || '').replace(/\D/g, '');
        if (!digitsOnly) {
            setError('Please enter your phone number');
            return;
        }
        const phoneConfig = getPhoneConfig(formData.country_code);
        const phoneError = phoneConfig.validate(digitsOnly);
        if (phoneError) {
            setError(phoneError);
            return;
        }

        const isRemainingBooking = formData.room_type === 'remaining';
        const adultsNum = Number(formData.adults) || (isRemainingBooking ? 1 : 3);
        const childrenNum = Number(formData.children) || 0;

        if (isRemainingBooking) {
            if (adultsNum < 1) {
                setError('At least 1 adult is required for the remaining room.');
                return;
            }
            if (adultsNum + childrenNum > 3) {
                setError('Remaining room allows a maximum of 1 to 3 members total.');
                return;
            }
        } else {
            if (adultsNum < 3) {
                setError('Minimum 3 adults required');
                return;
            }

            const maxAdultsForKids = getMaxAdults(childrenNum);
            if (adultsNum > maxAdultsForKids) {
                setError(`For ${childrenNum} children, maximum ${maxAdultsForKids} adults allowed.`);
                return;
            }
        }

        const checkIn  = checkInDate;
        const checkOut = checkOutDate;
        const nights   = stayNights;

        const newBookingId = confirmBookingId || generateBookingId();
        if (!confirmBookingId) setBookingId(newBookingId);

        const guests_count = formData.adults + formData.children;

        const totalAmount = calculateTotal();

        const bookingPayload = {
            booking_id: newBookingId,
            guest_name: formData.guest_name,
            email: formData.email,
            phone: formData.country_code + formData.phone,
            adults: formData.adults,
            children: formData.children,
            room_type: formData.room_type,
            booking_type: formData.room_type === 'partial' ? 'half villa'
                : formData.room_type === 'remaining' ? 'remaining'
                : 'full villa',
            room_label: formData.room_type === 'partial' ? 'Half Villa'
                : formData.room_type === 'remaining' ? 'Remaining Room'
                : 'Full Villa',
            guests_count,
            check_in_date: format(checkIn, 'yyyy-MM-dd'),
            check_out_date: format(checkOut, 'yyyy-MM-dd'),
            total_amount: totalAmount,
            status: 'Enquery',
            source: 'website',
            timestamp: new Date().toISOString(),
            payment: { status: 'enquiry' }
        };

        if (!booking_id) {
            // Save Enquiry directly into Supabase database via Backend API
            // Save enquiry via backend API
            fetch(`${API_URL}/api/registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingPayload)
            }).catch(() => {
                fetch(`${API_URL}/api/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingPayload)
                }).catch(err => console.error('Error saving enquiry to database:', err));
            });
        }

        setStep('payment');
    };

    const handlePaymentSuccess = async (status, paymentDetails = {}) => {
        const checkIn     = checkInDate;
        const checkOut    = checkOutDate;
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
            booking_type: formData.room_type === 'partial' ? 'half villa'
                : formData.room_type === 'remaining' ? 'remaining'
                : 'full villa',
            room_label: formData.room_type === 'partial' ? 'Half Villa'
                : formData.room_type === 'remaining' ? 'Remaining Room'
                : 'Full Villa',
            guests_count,
            check_in_date:  format(checkIn,  'yyyy-MM-dd'),
            check_out_date: format(checkOut, 'yyyy-MM-dd'),
            total_amount: totalAmount,
            status: status === 'verified' ? 'confirmed' : 'failed',
            payment_id: paymentDetails?.razorpay_payment_id || null,
            source: 'website'
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
            // Save Confirmed Booking directly into Supabase database via Backend API
            let regRes = await fetch(`${API_URL}/api/registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            }).catch(() => null);

            if (!regRes || !regRes.ok) {
                await fetch(`${API_URL}/api/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingPayload)
                }).catch(err => console.error('Error saving booking:', err));
            }

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
            await fetch(`${API_URL}/api/send-receipt`, {
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
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                    <CheckCircle2 size={56} color="#2C5F2D" />
                </div>
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
        if (!checkInDate || !checkOutDate) return 0;
        const s = new Date(checkInDate); s.setHours(0, 0, 0, 0);
        const e = new Date(checkOutDate); e.setHours(0, 0, 0, 0);
        const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    })();

    const totalAmount   = calculateTotal();
    const pricePerNight = getPriceForDate(checkInDate || new Date());

    const datesSelected = !!(checkInDate && checkOutDate);
    const rangeHasPartial = datesSelected && doesRangeHavePartial(checkInDate, checkOutDate);
    const partialAllowed  = canSelectPartial(formData.adults, formData.children);

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        if (isDateFullyBooked(date)) return null;
        const partial  = isDatePartiallyBooked(date);
        const customPrice = calendarData.rules[format(date, 'yyyy-MM-dd')]?.price;
        return (
            <div style={{ marginTop: '2px' }}>
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

        if (remainingStatus?.isRemainingEligible) {
            const extensionText = (remainingStatus.extendedBefore && remainingStatus.extendedAfter)
                ? ' (Includes 1-day check-in & check-out extension)'
                : remainingStatus.extendedBefore
                ? ' (Includes 1-day early check-in extension)'
                : remainingStatus.extendedAfter
                ? ' (Includes 1-day check-out extension)'
                : '';

            return (
                <div className="form-group">
                    <label>Room Option</label>
                    <select value="remaining" disabled style={{ opacity: 0.9, fontWeight: 500 }}>
                        <option value="remaining">Remaining room — ₹2,000/night</option>
                    </select>
                    <div style={{ ...infoStyle, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                        <span>Selected dates have a partial booking. Remaining room is available for 1–3 guests at ₹2,000/night.{extensionText}</span>
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
                <div className="krish-overlay">
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
                                {checkInDate && checkOutDate && nights > 0 ? (
                                    `${format(checkInDate, 'MMM dd')} – ${format(checkOutDate, 'MMM dd')} (${nights} night${nights > 1 ? 's' : ''})`
                                ) : checkInDate ? (
                                    <span>
                                        Check-in: <strong>{format(checkInDate, 'MMM dd, yyyy')}</strong> • <span style={{ color: '#d97706' }}>Please select Check-out date</span>
                                    </span>
                                ) : (
                                    'Select Check-in and Check-out dates'
                                )}
                            </div>

                            {dateConflict && (
                                <div style={{
                                    marginTop: '12px', background: '#fff3f3',
                                    border: '1px solid #ff4444', borderRadius: '8px',
                                    padding: '12px 16px', color: '#cc0000',
                                    fontWeight: '500', fontSize: '14px', textAlign: 'center',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    <AlertTriangle size={16} color="#cc0000" style={{ flexShrink: 0 }} />
                                    <span>{remainingStatus?.invalidReason === 'extension_exceeded'
                                        ? 'Remaining room can only be extended by at most 1 day earlier or 1 day later from the existing partial stay.'
                                        : remainingStatus?.invalidReason === 'extension_blocked'
                                        ? 'The extended check-in or check-out date is already booked or blocked. Please choose different dates.'
                                        : 'One or more selected dates are already booked or blocked. Please choose different dates.'}</span>
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
                                        onChange={handleCountryCodeChange}
                                    >
                                        {COUNTRY_CODES.map(c => (
                                             <option key={c.code} value={c.code}>{c.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        className="phone-number-input"
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={getPhoneConfig(formData.country_code).maxLength}
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        onKeyDown={(e) => {
                                            if (
                                                ['Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) ||
                                                ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
                                            ) {
                                                return;
                                            }
                                            if (!/^\d$/.test(e.key)) {
                                                e.preventDefault();
                                            }
                                        }}
                                        placeholder={getPhoneConfig(formData.country_code).placeholder}
                                        autoComplete="tel-national"
                                    />
                                </div>
                            </div>

                            {/* ── Guest Count ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label>Adults <span style={{ color: '#aaa', fontWeight: 400 }}>
                                        {isRemaining
                                            ? `(1–${Math.max(1, 3 - (Number(formData.children) || 0))})`
                                            : `(3–${getMaxAdults(formData.children)})`}
                                    </span></label>
                                    <input
                                        type="number"
                                        min={isRemaining ? 1 : 3}
                                        max={isRemaining ? Math.max(1, 3 - (Number(formData.children) || 0)) : getMaxAdults(formData.children)}
                                        value={formData.adults}
                                        onChange={handleAdultsChange}
                                        onBlur={handleAdultsBlur}
                                        onFocus={e => e.target.select()}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Children <span style={{ color: '#aaa', fontWeight: 400 }}>
                                        {isRemaining
                                            ? `(0–${Math.max(0, 3 - (Number(formData.adults) || 1))})`
                                            : `(0–${getMaxChildren(formData.adults)})`}
                                    </span></label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={isRemaining ? Math.max(0, 3 - (Number(formData.adults) || 1)) : getMaxChildren(formData.adults)}
                                        value={formData.children}
                                        onChange={handleChildrenChange}
                                        onBlur={handleChildrenBlur}
                                        onFocus={e => e.target.select()}
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
                                <div className="error-message" style={{
                                    marginBottom: '14px',
                                    padding: '12px 14px',
                                    background: '#fff3f3',
                                    border: '1px solid #ff4d4f',
                                    borderRadius: '8px',
                                    color: '#d32f2f',
                                    fontWeight: '500',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    lineHeight: '1.4'
                                }}>
                                    <AlertTriangle size={16} color="#cc0000" style={{ flexShrink: 0 }} />
                                    <span>{error}</span>
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
                                {dateConflict ? 'Dates Unavailable' : 'Proceed to Payment'}
                            </button>

                            <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <Lock size={12} color="#888" />
                                Secured by Razorpay
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
