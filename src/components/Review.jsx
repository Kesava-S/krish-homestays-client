import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function Review() {

    const [formData, setFormData] = useState({
        experience: '',
        rating: 0
    });

    const bookingId = useParams('booking_id');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRating = (value) => {
        setFormData({ ...formData, rating: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const { experience, rating } = formData;

        if (!experience || rating === 0) {
            setError('Please share your experience and provide a rating.');
            return;
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_N8N_URL}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: bookingId.booking_id,
                    ...formData,
                    source: 'website',
                    timestamp: new Date().toISOString()
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to submit review');
            }

            // ✅ Success Alert
            Swal.fire({
                icon: 'success',
                title: 'Thank You!',
                text: 'Your review has been submitted successfully.',
                confirmButtonColor: '#3085d6'
            });

            // redirect to google review when rating is 4 or 5.

            setFormData({ name: '', email: '', phone: '', experience: '', rating: 0 });

        } catch (err) {
            // ❌ Error Alert
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: err.message || 'Something went wrong. Please try again later.',
                confirmButtonColor: '#d33'
            });
        }
    };


    return (
        <div className="container" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="glass-card" style={{ padding: '30px' }}>
                <h2 className="text-center mb-3">Leave a Review</h2>
                <p className="text-center mb-4">We’d love to hear about your experience at <b>Krish Homestays</b>.</p>

                <form onSubmit={handleSubmit}>

                    <div className="form-group mb-3">
                        <label>How was your experience?</label>
                        <textarea
                            name="experience"
                            className="form-control"
                            rows="4"
                            placeholder="Share your stay experience..."
                            value={formData.experience}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group mb-4">
                        <label>Rating</label>
                        <div style={{ fontSize: '24px', cursor: 'pointer' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                    key={star}
                                    onClick={() => handleRating(star)}
                                    style={{
                                        color: formData.rating >= star ? '#f5c518' : '#ccc',
                                        marginRight: '5px'
                                    }}
                                >
                                    ★
                                </span>
                            ))}
                        </div>
                        <small>{formData.rating > 0 ? `You rated ${formData.rating}/5` : 'Please select a rating'}</small>
                    </div>

                    {error && <div className="text-danger" style={{ color: 'red' }}>{error}</div>}
                    {success && <div className="text-success" style={{ color: 'green' }}>{success}</div>}
                    <br />
                    <div className='w-100 text-center'>
                        <button type="submit" className="btn btn-primary w-100">
                            Submit Review
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
