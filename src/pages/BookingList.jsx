import React, { useEffect, useState } from 'react';
import './BookingList.css';
import Swal from 'sweetalert2';

export default function BookingList() {

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [saving, setSaving] = useState(false);

    const [modalMode, setModalMode] = useState('view'); // view | edit

    const [reviewData, setReviewData] = useState(null);


    // 🔹 Fetch Bookings
    const fetchBookings = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_N8N_URL}/krish_booking`)
            .then(res => res.json())
            .then(data => {
                setBookings(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch bookings', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    // 🔹 Open Modal
    const openModal = (row, mode = 'view') => {
        setSelectedRow(row);
        setModalMode(mode);
        setShowModal(true);
        setReviewData(null);

        if (row.review_status === 'yes') {
            fetch(`${import.meta.env.VITE_N8N_URL}/homestay_review?booking_id=${row.booking_id}`)
                .then(res => res.json())
                .then(data => setReviewData(data))
                .catch(err => console.error('Failed to fetch review', err));
        }
    };


    // 🔹 Close Modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedRow(null);
        setReviewData(null);
    };

    // 🔹 Update Booking
    const handleUpdate = async () => {
        try {
            setSaving(true);

            var newSelectedRow = {
                ...selectedRow,
                check_in_date: new Date(selectedRow.check_in_date).toISOString(),
                check_out_date: new Date(selectedRow.check_out_date).toISOString()
            }

            console.log(selectedRow);


            const res = await fetch(`${import.meta.env.VITE_N8N_URL}/update-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSelectedRow),
            });

            const data = await res.json();

            if (!data.success) throw new Error('Update failed');

            Swal.fire({
                icon: 'success',
                title: `Updated as status ${data.status != null ? data.status : "Pending | Cancelled"}`,
                text: 'Booking updated successfully!',
                confirmButtonColor: '#1f6f43'
            });

            closeModal();
            fetchBookings();

        } catch (err) {
            console.error(err);
            alert('Failed to update booking');
        } finally {
            setSaving(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const sortedBookings = [...bookings].sort(
        (a, b) => new Date(b.check_in_date) - new Date(a.check_in_date)
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;

    const currentBookings = sortedBookings.slice(
        indexOfFirstItem,
        indexOfLastItem
    );

    const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);

    const todayStr = new Date().toISOString().split("T")[0];

    return (
        <div>
            <h2>Bookings</h2>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                        <thead style={{ background: '#1e293b', color: '#fff' }}>
                            <tr>
                                <th style={th}>Booking ID</th>
                                <th style={th}>Name</th>
                                <th style={th}>Email</th>
                                <th style={th}>Phone</th>
                                <th style={th}>Check In</th>
                                <th style={th}>Check Out</th>
                                {/* <th style={th}>Guests</th> */}
                                <th style={th}>Visit Status</th>
                                <th style={th}>Amount</th>
                                <th style={th}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentBookings.map((b, i) => (
                                <tr key={i} style={{
                                    backgroundColor:
                                        String(b.check_in_date).split("T")[0] === todayStr
                                            ? '#f0f0f0'   // light grey for today check-in
                                            : 'transparent'
                                }}>
                                    <td style={td}>{b.booking_id}</td>
                                    <td style={td}>{b.guest_name}</td>
                                    <td style={td}>{b.email}</td>
                                    <td style={td}>{b.phone}</td>
                                    <td style={td}>{String(b.check_in_date).split("T")[0]}</td>
                                    <td style={td}>{String(b.check_out_date).split("T")[0]}</td>
                                    <td style={{ ...td, color: getStatusColor(b.visit_status) }}>
                                        {b.visit_status}
                                    </td>
                                    <td style={td}>
                                        {b.total_amount ? `₹${b.total_amount}` : '-'}
                                    </td>
                                    <td style={td}>
                                        <button
                                            className="btn btn-sm btn-info"
                                            onClick={() => openModal(b, 'view')}
                                        >
                                            View
                                        </button>

                                        {(b.visit_status === 'enquiry' || b.visit_status === 'pending' || b.visit_status === 'booked') && (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                style={{ marginLeft: '6px' }}
                                                onClick={() => openModal(b, 'edit')}
                                            >
                                                Update
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '15px', textAlign: 'center' }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className='btn btn-secondary'
                        >
                            Prev
                        </button>

                        <span style={{ margin: '0 10px' }}>
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className='btn btn-secondary'
                        >
                            Next
                        </button>
                    </div>

                </div>
            )}

            {/* 🔹 MODAL */}
            {showModal && selectedRow && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <h3>Booking Details</h3>

                        <div className="modal-grid">
                            <div>
                                <label>Booking ID</label>
                                <input type="text" value={selectedRow?.booking_id} disabled />
                            </div>

                            <div>
                                <label>Name</label>
                                <input type="text" value={selectedRow?.guest_name} disabled />
                            </div>

                            <div>
                                <label>Email</label>
                                <input type="text" value={selectedRow?.email} disabled />
                            </div>

                            <div>
                                <label>Phone</label>
                                <input type="text" value={selectedRow?.phone} disabled />
                            </div>

                            <div>
                                <label>Guests</label>
                                <input type="number" value={selectedRow?.guests_count} disabled />
                            </div>

                            <div>
                                <label>Check In</label>
                                <input
                                    type="date"
                                    value={String(selectedRow?.check_in_date).split("T")[0] || ''}
                                    min={today}
                                    disabled={modalMode === 'view'}
                                    onChange={(e) =>
                                        setSelectedRow({ ...selectedRow, check_in_date: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label>Check Out</label>
                                <input
                                    type="date"
                                    value={String(selectedRow?.check_out_date).split("T")[0] || ''}
                                    min={String(selectedRow?.check_in_date).split("T")[0] || today}
                                    disabled={modalMode === 'view'}
                                    onChange={(e) =>
                                        setSelectedRow({ ...selectedRow, check_out_date: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label>Total Amount</label>
                                <input
                                    type="number"
                                    value={selectedRow.total_amount || ''}
                                    disabled={modalMode === 'view'}
                                    onChange={(e) =>
                                        setSelectedRow({ ...selectedRow, total_amount: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label>Visit Status</label>
                                <select
                                    value={selectedRow.visit_status || 'enquiry'}
                                    disabled={modalMode === 'view'}
                                    onChange={(e) =>
                                        setSelectedRow({ ...selectedRow, visit_status: e.target.value })
                                    }
                                >
                                    <option value="enquiry">Enquiry</option>
                                    <option value="visited">Visited</option>
                                    <option value="pending">Pending</option>
                                    <option value="booked">Booked</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>


                            <div>
                                <label>Payment ID</label>
                                <input
                                    type="text"
                                    value={selectedRow.payment_id || ''}
                                    disabled={modalMode === 'view'}
                                    onChange={(e) =>
                                        setSelectedRow({ ...selectedRow, payment_id: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            {modalMode === 'edit' && (
                                <button className="btn btn-success" disabled={saving} onClick={handleUpdate} style={{ backgroundColor: '#84934A' }}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            )}

                            <button className="btn btn-secondary" onClick={closeModal} style={{ backgroundColor: '#A8BBA3' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

/* Styles */
const th = { padding: '10px', border: '1px solid #ddd' };
const td = { padding: '10px', border: '1px solid #ddd', textAlign: 'center' };

const getStatusColor = (status) => {
    if (status === 'confirmed' || status === 'booked') return 'green';
    if (status === 'pending' || status === 'enquiry') return 'orange';
    if (status === 'failed' || status === 'cancelled') return 'red';
    return '#333';
};
