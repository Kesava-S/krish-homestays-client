import React, { useState } from 'react';
import Swal from 'sweetalert2';

export default function Cancellation() {

    const [bookingId, setBookingId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCancel = async () => {
        if (!bookingId.trim()) {
            Swal.fire('Missing Booking ID', 'Please enter your booking ID', 'warning');
            return;
        }

        const confirm = await Swal.fire({
            title: 'Confirm Cancellation',
            text: `Are you sure you want to cancel booking: ${bookingId}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Cancel Booking',
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_N8N_URL}/cancel-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: bookingId,
                    action: 'cancel',
                    source: 'website',
                    timestamp: new Date().toISOString()
                })
            });

            const data = await res.json();

            // ✅ FIXED CONDITION
            if (res.ok && data.status === 'success') {
                Swal.fire(
                    'Cancelled Successfully',
                    data.message || 'Your booking has been cancelled successfully.',
                    'success'
                );
                setBookingId('');
            } else if (data.status === 'exist') {
                Swal.fire(
                    'Booking already cancelled',
                    data.message || 'Your booking has been cancelled Already.',
                    'warning'
                );
                setBookingId('');
            } else {
                throw new Error(data.message || 'Cancellation failed');
            }

        } catch (error) {
            Swal.fire(
                'Cancellation Failed',
                error.message || 'Something went wrong. Please contact support.',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="container" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="glass-card" style={{ padding: '30px' }}>
                <h2 className="text-center mb-3">Cancel Your Booking</h2>

                <p>
                    If you wish to cancel your booking at <b>Krish Homestay</b>, please read our
                    cancellation policy carefully before proceeding.
                </p>
                <br />
                <h4>📜 Cancellation Policy</h4>
                <ul style={{ listStyle: 'none' }}>
                    <li>✔ Free cancellation up to 48 hours before check-in.</li>
                    <li>✔ 50% refund if cancelled within 24–48 hours before check-in.</li>
                    <li>❌ No refund for same-day cancellations or no-shows.</li>
                    <li>✔ Refunds (if applicable) are processed within 5–7 working days.</li>
                </ul>
                <br />
                <h4>⚠ Rules</h4>
                <ul style={{ listStyle: 'none' }}>
                    <li>• Cancellation must be done using the same Booking ID.</li>
                    <li>• Once cancelled, the booking cannot be restored.</li>
                    <li>• Contact support for any disputes.</li>
                </ul>

                <div className="form-group mt-4">
                    <label><b>Enter Booking ID</b></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. KH-20250215-8XK2Q"
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                    />
                </div>
                <div className='w-100 text-center'>
                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="btn btn-danger"
                        style={{ backgroundColor: '#F63049', color: '#fff' }}
                    >
                        {loading ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                </div>
            </div>
        </div>
    );
}
