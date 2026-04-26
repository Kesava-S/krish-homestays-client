import React, { useEffect, useState } from 'react';
import './BookingList.css';
import Swal from 'sweetalert2';

const fmtDate = (d) => (d ? String(d).split('T')[0] : '—');

export default function BookingList() {

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalMode, setModalMode] = useState('view');
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 8;

    const fetchBookings = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_N8N_URL}/krish_booking`)
            .then(res => res.json())
            .then(data => { setBookings(data || []); setLoading(false); })
            .catch(err => { console.error('Failed to fetch bookings', err); setLoading(false); });
    };

    useEffect(() => { fetchBookings(); }, []);

    const openModal = (row, mode = 'view') => {
        setSelectedRow(row);
        setModalMode(mode);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedRow(null);
    };

    const handleUpdate = async () => {
        try {
            setSaving(true);
            const payload = {
                ...selectedRow,
                'Check In Date': new Date(selectedRow['Check In Date']).toISOString(),
                'Check Out Date': new Date(selectedRow['Check Out Date']).toISOString(),
            };
            const res = await fetch(`${import.meta.env.VITE_N8N_URL}/update-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) throw new Error('Update failed');
            Swal.fire({
                icon: 'success',
                title: 'Updated Successfully',
                text: 'Booking updated!',
                confirmButtonColor: '#1f6f43',
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

    const set = (field, value) => setSelectedRow(r => ({ ...r, [field]: value }));

    const todayStr = new Date().toISOString().split('T')[0];

    const sortedBookings = [...bookings].sort(
        (a, b) => new Date(b['Check In Date']) - new Date(a['Check In Date'])
    );
    const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);
    const currentBookings = sortedBookings.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div>
            <h2>Bookings</h2>

            {loading ? <p>Loading...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.88rem' }}>
                        <thead style={{ background: '#1e293b', color: '#fff' }}>
                            <tr>
                                <th style={th}>Booking ID</th>
                                <th style={th}>Date</th>
                                <th style={th}>Guest Name</th>
                                <th style={th}>Phone</th>
                                <th style={th}>Check In</th>
                                <th style={th}>Check Out</th>
                                <th style={th}>Type</th>
                                <th style={th}>Guests</th>
                                <th style={th}>Status</th>
                                <th style={th}>Amount</th>
                                <th style={th}>Source</th>
                                <th style={th}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentBookings.map((b, i) => (
                                <tr key={i} style={{ backgroundColor: fmtDate(b['Check In Date']) === todayStr ? '#f0f9f4' : 'transparent' }}>
                                    <td style={td}>{b['Booking Id'] || '—'}</td>
                                    <td style={td}>{fmtDate(b['Date'])}</td>
                                    <td style={td}>{b['Guest Name'] || '—'}</td>
                                    <td style={td}>{b['Phone Number'] || '—'}</td>
                                    <td style={td}>{fmtDate(b['Check In Date'])}</td>
                                    <td style={td}>{fmtDate(b['Check Out Date'])}</td>
                                    <td style={td}>{b['Booking Type'] || '—'}</td>
                                    <td style={td}>{b['Guest Count'] || '—'}</td>
                                    <td style={{ ...td, color: getStatusColor(b['Status']), fontWeight: '600' }}>
                                        {b['Status'] || '—'}
                                    </td>
                                    <td style={td}>{b['Total Amount'] ? `₹${b['Total Amount']}` : '—'}</td>
                                    <td style={td}>{b['source'] || '—'}</td>
                                    <td style={td}>
                                        <button className="btn btn-sm btn-info" onClick={() => openModal(b, 'view')}>View</button>
                                        {canEdit(b['Status']) && (
                                            <button className="btn btn-sm btn-primary" style={{ marginLeft: '6px' }} onClick={() => openModal(b, 'edit')}>
                                                Update
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '15px', textAlign: 'center' }}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn btn-secondary">Prev</button>
                        <span style={{ margin: '0 10px' }}>Page {currentPage} of {totalPages || 1}</span>
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="btn btn-secondary">Next</button>
                    </div>
                </div>
            )}

            {/* ── MODAL ── */}
            {showModal && selectedRow && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
                        <h3>{modalMode === 'edit' ? 'Update Booking' : 'Booking Details'}</h3>

                        {/* Guest Information */}
                        <div className="modal-section-label">Guest Information</div>
                        <div className="modal-grid">
                            <ViewField label="Booking ID"   value={selectedRow['Booking Id']} />
                            <ViewField label="Booking Date" value={fmtDate(selectedRow['Date'])} />
                            <ViewField label="Guest Name"   value={selectedRow['Guest Name']} />
                            <ViewField label="Email"        value={selectedRow['Email']} />
                            <ViewField label="Phone Number" value={selectedRow['Phone Number']} />
                            <div />
                        </div>

                        {/* Stay Details */}
                        <div className="modal-section-label">Stay Details</div>
                        <div className="modal-grid">
                            <div>
                                <label>Check In Date</label>
                                <input type="date" value={fmtDate(selectedRow['Check In Date'])} disabled={modalMode === 'view'}
                                    onChange={e => set('Check In Date', e.target.value)} />
                            </div>
                            <div>
                                <label>Check Out Date</label>
                                <input type="date" value={fmtDate(selectedRow['Check Out Date'])} disabled={modalMode === 'view'}
                                    onChange={e => set('Check Out Date', e.target.value)} />
                            </div>
                            <ViewField label="Guest Count"    value={selectedRow['Guest Count']} />
                            <ViewField label="Guest Adults"   value={selectedRow['Guest Adults']} />
                            <ViewField label="Guest Children" value={selectedRow['Guest Children']} />
                            <div>
                                <label>Booking Type</label>
                                <select value={selectedRow['Booking Type'] || ''} disabled={modalMode === 'view'}
                                    onChange={e => set('Booking Type', e.target.value)}>
                                    <option value="">— Select —</option>
                                    <option value="full villa">Full Villa</option>
                                    <option value="half villa">Half Villa</option>
                                    <option value="remaining">Remaining Room</option>
                                </select>
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="modal-section-label">Payment</div>
                        <div className="modal-grid">
                            <div>
                                <label>Total Amount (₹)</label>
                                <input type="number" value={selectedRow['Total Amount'] || ''} disabled={modalMode === 'view'}
                                    onChange={e => set('Total Amount', e.target.value)} />
                            </div>
                            <div>
                                <label>Payment ID</label>
                                <input type="text" value={selectedRow['Payment ID'] || ''} disabled={modalMode === 'view'}
                                    onChange={e => set('Payment ID', e.target.value)} />
                            </div>
                        </div>

                        {/* Booking Source */}
                        <div className="modal-section-label">Booking Source</div>
                        <div className="modal-grid">
                            <ViewField label="Source"      value={selectedRow['source']} />
                            <ViewField label="Calendar ID" value={selectedRow['Calendar Id']} />
                        </div>

                        {/* Admin Status */}
                        <div className="modal-section-label">Status & Flags</div>
                        <div className="modal-grid">
                            <div>
                                <label>Status</label>
                                <select value={selectedRow['Status'] || 'enquiry'} disabled={modalMode === 'view'}
                                    onChange={e => set('Status', e.target.value)}>
                                    <option value="enquiry">Enquiry</option>
                                    <option value="pending">Pending</option>
                                    <option value="booked">Booked</option>
                                    <option value="visited">Visited</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label>Confirmation Sent</label>
                                <select value={selectedRow['Confirmation Sent'] || 'no'} disabled={modalMode === 'view'}
                                    onChange={e => set('Confirmation Sent', e.target.value)}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </div>
                            <div>
                                <label>Remainder Sent</label>
                                <select value={selectedRow['Remainder Sent'] || 'no'} disabled={modalMode === 'view'}
                                    onChange={e => set('Remainder Sent', e.target.value)}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </div>
                            <div>
                                <label>Review Requested</label>
                                <select value={selectedRow['Review Requested'] || 'no'} disabled={modalMode === 'view'}
                                    onChange={e => set('Review Requested', e.target.value)}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="modal-section-label">Notes</div>
                        <textarea
                            rows={3}
                            value={selectedRow['Notes'] || ''}
                            disabled={modalMode === 'view'}
                            onChange={e => set('Notes', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                        />

                        <div className="modal-actions">
                            {modalMode === 'edit' && (
                                <button className="btn btn-success" disabled={saving} onClick={handleUpdate} style={{ backgroundColor: '#2C5F2D' }}>
                                    {saving ? 'Saving...' : 'Save Changes'}
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

function ViewField({ label, value }) {
    return (
        <div>
            <label>{label}</label>
            <input type="text" value={value || '—'} disabled />
        </div>
    );
}

const th = { padding: '10px 12px', border: '1px solid #2d3d55', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '9px 12px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' };

const canEdit = (status) => ['enquiry', 'pending', 'booked'].includes(status);

const getStatusColor = (status) => {
    if (status === 'booked' || status === 'visited') return '#16a34a';
    if (status === 'pending' || status === 'enquiry') return '#d97706';
    if (status === 'cancelled') return '#dc2626';
    return '#334155';
};
