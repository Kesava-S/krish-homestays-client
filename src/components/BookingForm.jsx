import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import API_URL from '../config';
import './BookingForm.css';
import { useParams } from 'react-router-dom';

const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;

        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);

        document.body.appendChild(script);
    });
};


const CheckoutForm = ({ bookingData, onPaymentSuccess, onCancel }) => {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

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
                name: "Krish Home Stay",
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
                    contact: bookingData.phone,
                },

                theme: { color: "#3399cc" }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (err) {
            setError("Payment failed");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="payment-form text-center">
            <div className='payment-details'>
                <h3>Secure Payment</h3>
                <b><p>Total : ₹{bookingData.total_amount}</p></b>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="payment-actions">
                <button onClick={onCancel} className="btn btn-secondary">Back</button>
                <button
                    onClick={handlePayment}
                    disabled={processing}
                    className="btn btn-primary"
                >
                    {processing ? "Processing..." : `Pay ₹${bookingData.total_amount}`}
                </button>
            </div>
        </div>
    );
};


const BookingForm = () => {
    const [dateRange, setDateRange] = useState(null);
    const [calendarData, setCalendarData] = useState({ bookedRanges: [], rules: {} });
    const [formData, setFormData] = useState({
        guest_name: '',
        email: '',
        phone: '',
        guests_count: 6,
    });
    const [step, setStep] = useState('details'); // details, payment, success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('idle');
    // idle | verifying | success | failed

    const [confirmBookingId, setBookingId] = useState('');

    const bookingId = useParams('booking_id');    

    useEffect(() => {
        fetch(`${API_URL}/api/calendar-data`)
            .then(res => res.json())
            .then(data => {
                setCalendarData(data);
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!bookingId) return;

        const fetchBooking = async () => {
            try {
                const data = await fetch(
                    `${import.meta.env.VITE_N8N_URL}/wh-enquiry?booking_id=${bookingId.booking_id}`
                );            

                if (!data) return;

                // populate form
                setFormData({
                    guest_name: data.guest_name || '',
                    email: data.email || '',
                    phone: data.phone_number || '',
                    guests_count: data.guests_count || 6,
                });

                // set calendar range
                if (data.check_in_date && data.check_out_date) {
                    setDateRange([
                        new Date(data.check_in_date),
                        new Date(data.check_out_date)
                    ]);
                }

                setBookingId(data.booking_id);

            } catch (err) {
                console.error("Failed to load booking", err);
            }
        };

        fetchBooking();
    }, [bookingId]);


    const isDateUnavailable = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (calendarData.rules[dateStr]?.status === 'blocked') return true;
        return calendarData.bookedRanges.some(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d >= start && d < end;
        });
    };

    const getPriceForDate = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return calendarData.rules[dateStr]?.price || 7000;
    };

    const calculateTotal = () => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return 0;
        let total = 0;
        let current = new Date(dateRange[0]);
        const end = new Date(dateRange[1]);
        while (current < end) {
            total += getPriceForDate(current);
            current.setDate(current.getDate() + 1);
        }
        return total;
    };

    const isValidName = (name) => /^[A-Za-z\s]{3,}$/.test(name);
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone) => /^(\+91)?[6-9]\d{9}$/.test(phone);


    const generateBookingId = () => {
        if (!dateRange || !dateRange[0]) return "KH-INVALID";

        // Format booking date (YYYYMMDD)
        const d = new Date(dateRange[0]);
        const yyyyMMdd = d.toISOString().slice(0, 10).replace(/-/g, '');

        // Unique suffix: timestamp + random
        const unique = (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)).toUpperCase();

        // Short unique part
        const shortSuffix = unique.slice(-5);

        // Final Booking ID: KH-YYYYMMDD-XXXXX
        return `KH-${yyyyMMdd}-${shortSuffix}`;
    };


    const handleDetailsSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isValidName(formData.guest_name)) {
            setError('Please enter a valid full name');
            return;
        }

        if (!isValidEmail(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (!isValidPhone(formData.phone)) {
            setError('Please enter a valid phone number');
            return;
        }

        if (!dateRange || !dateRange[0] || !dateRange[1]) {
            setError('Please select check-in and check-out dates');
            return;
        }

        const checkIn = dateRange[0];
        const checkOut = dateRange[1];

        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        if (nights < 1) {
            setError('Minimum stay is 1 night');
            return;
        }

        // ✅ Generate booking ID
        const newBookingId = generateBookingId();
        setBookingId(newBookingId);

        // 🔔 Call enquiry webhook (non-blocking)
        fetch(`${import.meta.env.VITE_N8N_URL}/registeration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                booking_id: newBookingId,
                ...formData,
                check_in_date: format(checkIn, 'yyyy-MM-dd'),
                check_out_date: format(checkOut, 'yyyy-MM-dd'),
                source: 'website',
                timestamp: new Date().toISOString(),
                payment: { status: 'enquiry' }
            })
        }).catch(err => console.error('Enquiry webhook failed', err));

        // 👉 Move to payment step
        setStep('payment');
    };


    const handlePaymentSuccess = async (status, paymentDetails = {}) => {
        const checkIn = dateRange[0];
        const checkOut = dateRange[1];
        const totalAmount = calculateTotal();
        const bookingId = confirmBookingId;

        const bookingPayload = {
            booking_id: bookingId,
            ...formData,
            check_in_date: format(checkIn, 'yyyy-MM-dd'),
            check_out_date: format(checkOut, 'yyyy-MM-dd'),
            total_amount: totalAmount
        };

        // 🔹 COMMON webhook payload
        const webhookPayload = {
            booking: bookingPayload,
            payment: {
                status: status === 'verified' ? 'booked' : 'failed',
                booking_id: bookingId,
                payment_id: paymentDetails?.razorpay_payment_id || null,
                order_id: paymentDetails?.razorpay_order_id || null,
                signature: paymentDetails?.razorpay_signature || null,
                amount: paymentDetails?.amount || totalAmount,
                currency: paymentDetails?.currency || 'INR',
                gateway: 'razorpay'
            },
            meta: {
                source: 'website',
                timestamp: new Date().toISOString()
            }
        };

        try {
            // 🔥 HIT n8n webhook (for BOTH success & failure)
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

            // ✅ Payment verified
            setPaymentStatus('success');
            setStep('success');

        } catch (err) {
            setPaymentStatus('failed');
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateReceiptAndNotify = async (webhookPayload) => {
        try {
            // 1️⃣ Call Node API to generate PDF
            const receiptRes = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
            });

            const receiptData = await receiptRes.json();
            // example: { success: true, pdfUrl: "http://..." }

            console.log("------Receipt data:" + receiptData);


            // 2️⃣ Send result to n8n webhook
            await fetch(`${import.meta.env.VITE_N8N_URL}/receipt-ready`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...webhookPayload,
                    receipt: receiptData,   // attach pdf info
                }),
            });

            console.log('Receipt sent to n8n');

        } catch (err) {
            console.error('Receipt flow failed', err);
        }
    };


    if (step === 'success') {
        return (
            <div className="glass-card text-center section" style={{ padding: '50px' }}>
                <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>Booking Confirmed!</h2>
                <p>Thank you, {formData.guest_name}.</p>
                <p>We have sent a confirmation to <strong>{formData.email}</strong>.</p>
                <button className="btn btn-primary mt-4" onClick={() => window.location.href('/book')}>Book Another Stay</button>
            </div>
        );
    }

    const nights = dateRange && dateRange[0] && dateRange[1] ? Math.ceil((dateRange[1] - dateRange[0]) / (1000 * 60 * 60 * 24)) : 0;
    const totalAmount = calculateTotal();

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        if (isDateUnavailable(date)) return null;
        const price = getPriceForDate(date);
        return <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>₹{price}</div>;
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
                        <div className="calendar-section">
                            <Calendar
                                selectRange={true}
                                onChange={setDateRange}
                                value={dateRange}
                                tileDisabled={({ date }) => isDateUnavailable(date)}
                                tileContent={getTileContent}
                                minDate={new Date()}
                                className="custom-calendar"
                            />
                            <div className="mt-4 text-center" style={{ fontWeight: '500', color: 'var(--primary)' }}>
                                {nights > 0 ?
                                    `${format(dateRange[0], 'MMM dd')} - ${format(dateRange[1], 'MMM dd')} (${nights} nights)`
                                    : 'Select Check-in and Check-out dates'}
                            </div>
                        </div>

                        <form onSubmit={handleDetailsSubmit} className="form-section">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" value={formData.guest_name} onChange={e => setFormData({ ...formData, guest_name: e.target.value })} placeholder="John Doe" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                            </div>
                            <div className="form-group">
                                <label>Phone / WhatsApp</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 98765 43210" />
                            </div>
                            <div className="form-group">
                                <label>Guests</label>
                                <select value={formData.guests_count} onChange={e => setFormData({ ...formData, guests_count: parseInt(e.target.value) })}>
                                    {[6, 7, 8, 9, 10, 11, 12, 13].map(n => <option key={n} value={n}>{n} Guests</option>)}
                                </select>
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem' }}>
                                Proceed to Payment
                            </button>

                        </form>
                    </div>
                ) : (
                    <div className="payment-section">
                        <CheckoutForm
                            bookingData={{ ...formData, total_amount: totalAmount }}
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
