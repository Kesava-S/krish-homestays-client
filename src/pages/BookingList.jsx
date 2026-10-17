import React, { useEffect, useState } from 'react';
import { Trash2, Eye, Pencil, RefreshCw, Plus, AlertTriangle } from 'lucide-react';
import './BookingList.css';
import Swal from 'sweetalert2';
import API_URL from '../config';
import { parseApiResponse } from '../utils/apiHelper';

const fmtDate = (d) => (d ? String(d).split('T')[0] : '—');

const checkBookingConflict = (checkInStr, checkOutStr, bookingType, currentBookingId, bookingsList) => {
    if (!checkInStr || !checkOutStr || !Array.isArray(bookingsList)) return null;

    const newStart = new Date(checkInStr); newStart.setHours(0, 0, 0, 0);
    const newEnd = new Date(checkOutStr); newEnd.setHours(0, 0, 0, 0);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newStart >= newEnd) return null;

    const reqType = String(bookingType || 'full villa').toLowerCase();
    const isIncomingPartial = reqType.includes('half') || reqType.includes('partial');
    const isIncomingRemaining = reqType.includes('remaining');
    const isIncomingFull = !isIncomingPartial && !isIncomingRemaining;

    for (const b of bookingsList) {
        const bId = b['Booking Id'] || b['Booking ID'] || b.booking_id;
        if (currentBookingId && bId && String(bId).trim().toUpperCase() === String(currentBookingId).trim().toUpperCase()) {
            continue;
        }

        const bStatus = String(b['Status'] || b.status || '').toLowerCase();
        if (bStatus !== 'confirmed' && bStatus !== 'booked') continue;

        const bStart = new Date(b['Check In Date'] || b.check_in_date); bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(b['Check Out Date'] || b.check_out_date); bEnd.setHours(0, 0, 0, 0);
        if (isNaN(bStart.getTime()) || isNaN(bEnd.getTime())) continue;

        const overlaps = (newStart < bEnd && newEnd > bStart);
        if (!overlaps) continue;

        const existingType = String(b['Booking Type'] || b.booking_type || b.room_type || 'full villa').toLowerCase();
        const isExistingPartial = existingType.includes('half') || existingType.includes('partial');
        const isExistingRemaining = existingType.includes('remaining');
        const isExistingFull = !isExistingPartial && !isExistingRemaining;

        let conflicts = false;
        if (isIncomingFull) {
            conflicts = true;
        } else if (isIncomingPartial) {
            if (isExistingFull || isExistingPartial) conflicts = true;
        } else if (isIncomingRemaining) {
            if (isExistingFull || isExistingRemaining) conflicts = true;
        }

        if (conflicts) {
            return {
                bookingId: bId || '—',
                guestName: b['Guest Name'] || b.guest_name || 'Guest',
                bookingType: b['Booking Type'] || b.booking_type || 'Full Villa',
                checkIn: fmtDate(bStart),
                checkOut: fmtDate(bEnd)
            };
        }
    }

    return null;
};

const parseNotes = (rawNotes) => {
    if (!rawNotes || !String(rawNotes).trim()) return [];
    const text = String(rawNotes).trim();

    let entries = [];
    if (text.includes('\n')) {
        entries = text.split('\n');
    } else if (text.includes(' | ')) {
        entries = text.split(' | ');
    } else {
        entries = [text];
    }

    const flatEntries = [];
    for (const item of entries) {
        if (item.includes(' | ')) {
            flatEntries.push(...item.split(' | '));
        } else {
            flatEntries.push(item);
        }
    }

    return flatEntries
        .map(e => e.trim())
        .filter(e => e.length > 0)
        .map(e => {
            let clean = e.replace(/^[•\-\*]\s*/, '').trim();
            const dateMatch = clean.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/);
            if (dateMatch) {
                return {
                    date: dateMatch[1],
                    text: dateMatch[2]
                };
            }
            return {
                date: null,
                text: clean
            };
        });
};

export default function BookingList() {

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalMode, setModalMode] = useState('view');
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 8;

    const conflictInfo = selectedRow && (modalMode === 'add' || modalMode === 'edit')
        ? checkBookingConflict(
            selectedRow['Check In Date'],
            selectedRow['Check Out Date'],
            selectedRow['Booking Type'],
            modalMode === 'edit' ? (selectedRow['Booking Id'] || selectedRow['Booking ID'] || selectedRow.booking_id) : null,
            bookings
          )
        : null;

    const parsedNotes = selectedRow ? parseNotes(selectedRow['Notes']) : [];

    const fetchBookings = () => {
        setLoading(true);
        fetch(`${API_URL}/api/admin/bookings`)
            .then(res => parseApiResponse(res, 'Failed to fetch bookings'))
            .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(err => { console.error('Failed to fetch bookings', err); setLoading(false); });
    };

    useEffect(() => { fetchBookings(); }, []);

    const openModal = (row, mode = 'view') => {
        if (mode === 'add') {
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todayDateStr = now.toISOString().split('T')[0];
            const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
            setSelectedRow({
                'Booking Id': 'Auto-generated',
                'Date': todayDateStr,
                'Guest Name': '',
                'Email': '',
                'Phone Number': '',
                'Check In Date': todayDateStr,
                'Check Out Date': tomorrowDateStr,
                'Booking Type': 'full villa',
                'Guest Count': 2,
                'Guest Adults': 2,
                'Guest Children': 0,
                'Status': 'confirmed',
                'Total Amount': '',
                'Payment ID': '',
                'source': 'admin',
                'Confirmation Sent': 'no',
                'Remainder Sent': 'no',
                'Review Requested': 'no',
                'Notes': ''
            });
        } else {
            setSelectedRow(row);
        }
        setModalMode(mode);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedRow(null);
    };

    const handleDeleteBooking = (booking) => {
        const bookingId = booking['Booking Id'] || booking['Booking ID'] || booking.booking_id;
        const guestName = booking['Guest Name'] || booking.guest_name || 'this guest';

        Swal.fire({
            title: 'Delete Booking?',
            text: `Are you sure you want to delete booking ${bookingId} for ${guestName}? This will also release any reserved dates in the calendar.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API_URL}/api/admin/delete-booking`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ booking_id: bookingId })
                    });
                    const data = await parseApiResponse(res, 'Failed to delete booking');

                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: `Booking ${bookingId} has been deleted.`,
                        confirmButtonColor: '#2C5F2D'
                    });
                    fetchBookings();
                } catch (err) {
                    console.error('Error deleting booking:', err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: err.message || 'Failed to delete booking.',
                        confirmButtonColor: '#2C5F2D'
                    });
                }
            }
        });
    };

    const handleUpdate = async () => {
        if (conflictInfo) {
            Swal.fire({
                icon: 'error',
                title: 'Dates Already Booked',
                html: `Already booked at that particular date by <b>${conflictInfo.guestName}</b><br/>(Booking ID: <b style="color: #b91c1c;">${conflictInfo.bookingId}</b> — ${conflictInfo.bookingType})<br/><br/><b>Existing stay:</b> ${conflictInfo.checkIn} to ${conflictInfo.checkOut}<br/><br/>Please choose different dates.`,
                confirmButtonColor: '#2C5F2D',
            });
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...selectedRow,
                'Check In Date': new Date(selectedRow['Check In Date']).toISOString(),
                'Check Out Date': new Date(selectedRow['Check Out Date']).toISOString(),
            };
            const bookingId = payload['Booking Id'] || payload['Booking ID'] || payload.booking_id;
            const updatePayload = {
                booking_id: bookingId,
                updates: {
                    status: payload['Status'],
                    notes: payload['Notes'],
                    check_in_date: payload['Check In Date'],
                    check_out_date: payload['Check Out Date'],
                    guest_name: payload['Guest Name'],
                    phone: payload['Phone Number'],
                    email: payload['Email'],
                    total_amount: payload['Total Amount']
                },
                ...payload
            };

            let res = await fetch(`${API_URL}/api/admin/update-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload),
            });
            if (!res.ok) {
                res = await fetch(`${API_URL}/api/update-booking`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload),
                });
            }
            const data = await parseApiResponse(res, 'Update failed');
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

    const handleSaveBooking = async () => {
        if (modalMode === 'add') {
            if (!selectedRow['Guest Name']?.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Guest Name Required',
                    text: 'Please enter guest name.',
                    confirmButtonColor: '#2C5F2D',
                });
                return;
            }
            if (!selectedRow['Check In Date'] || !selectedRow['Check Out Date']) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Dates Required',
                    text: 'Please provide both check-in and check-out dates.',
                    confirmButtonColor: '#2C5F2D',
                });
                return;
            }
            if (conflictInfo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Dates Already Booked',
                    html: `Already booked at that particular date by <b>${conflictInfo.guestName}</b><br/>(Booking ID: <b style="color: #b91c1c;">${conflictInfo.bookingId}</b> — ${conflictInfo.bookingType})<br/><br/><b>Existing stay:</b> ${conflictInfo.checkIn} to ${conflictInfo.checkOut}<br/><br/>Please choose different dates.`,
                    confirmButtonColor: '#2C5F2D',
                });
                return;
            }
            try {
                setSaving(true);
                const res = await fetch(`${API_URL}/api/admin/add-booking`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(selectedRow),
                });
                const data = await parseApiResponse(res, 'Failed to create booking');
                Swal.fire({
                    icon: 'success',
                    title: 'Booking Created',
                    text: `Booking ${data.booking?.booking_id || ''} created successfully!`,
                    confirmButtonColor: '#2C5F2D',
                });
                closeModal();
                fetchBookings();
            } catch (err) {
                console.error(err);
                Swal.fire({
                    icon: 'error',
                    title: 'Creation Failed',
                    text: err.message || 'Could not create booking.',
                    confirmButtonColor: '#2C5F2D',
                });
            } finally {
                setSaving(false);
            }
        } else {
            await handleUpdate();
        }
    };

    const set = (field, value) => setSelectedRow(r => ({ ...r, [field]: value }));

    const todayStr = new Date().toISOString().split('T')[0];

    const getMinCheckOut = (checkInStr) => {
        if (!checkInStr) return todayStr;
        try {
            const d = new Date(checkInStr);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        } catch {
            return todayStr;
        }
    };

    const handleCheckInChange = (newCheckIn) => {
        setSelectedRow(prev => {
            if (!prev) return prev;
            const currentCheckOut = prev['Check Out Date'] ? fmtDate(prev['Check Out Date']) : '';
            const minCheckOut = getMinCheckOut(newCheckIn);
            let updatedCheckOut = currentCheckOut;
            if (!currentCheckOut || currentCheckOut <= newCheckIn) {
                updatedCheckOut = minCheckOut;
            }
            return {
                ...prev,
                'Check In Date': newCheckIn,
                'Check Out Date': updatedCheckOut
            };
        });
    };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0 }}>Bookings</h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        ({bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'})
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={fetchBookings}
                        className="admin-filter-btn"
                        title="Refresh bookings list"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => openModal(null, 'add')}
                        className="admin-add-btn"
                    >
                        <Plus size={16} /> Add Booking
                    </button>
                </div>
            </div>

            {loading ? <p>Loading...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.88rem' }}>
                        <thead style={{ background: '#1e293b', color: '#fff' }}>
                            <tr>
                                <th style={{ ...th, width: '60px', textAlign: 'center' }}>S.No</th>
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
                                <th style={th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentBookings.map((b, i) => (
                                <tr key={i} style={{ backgroundColor: fmtDate(b['Check In Date']) === todayStr ? '#f0f9f4' : 'transparent' }}>
                                    <td style={{ ...td, textAlign: 'center', fontWeight: '500', color: '#64748b' }}>
                                        {(currentPage - 1) * itemsPerPage + i + 1}
                                    </td>
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
                                        <div className="action-buttons-group">
                                            <button
                                                type="button"
                                                className="action-icon-btn action-delete-btn"
                                                title="Delete Booking"
                                                aria-label="Delete Booking"
                                                onClick={() => handleDeleteBooking(b)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn action-view-btn"
                                                title="View Booking"
                                                aria-label="View Booking"
                                                onClick={() => openModal(b, 'view')}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {canEdit(b['Status']) && (
                                                <button
                                                    type="button"
                                                    className="action-icon-btn action-edit-btn"
                                                    title="Edit Booking"
                                                    aria-label="Edit Booking"
                                                    onClick={() => openModal(b, 'edit')}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                            )}
                                        </div>
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
                        <h3>
                            {modalMode === 'add' && 'Create New Booking'}
                            {modalMode === 'edit' && 'Edit Booking'}
                            {modalMode === 'view' && 'Booking Details'}
                        </h3>

                        {/* Guest Information */}
                        <div className="modal-section-label">Guest Information</div>
                        <div className="modal-grid">
                            {modalMode === 'view' ? (
                                <>
                                    <ViewField label="Booking ID"   value={selectedRow['Booking Id']} />
                                    <ViewField label="Booking Date" value={fmtDate(selectedRow['Date'])} />
                                    <ViewField label="Guest Name"   value={selectedRow['Guest Name']} />
                                    <ViewField label="Email"        value={selectedRow['Email']} />
                                    <ViewField label="Phone Number" value={selectedRow['Phone Number']} />
                                    <div />
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label>Booking ID</label>
                                        <input type="text" value={modalMode === 'add' ? 'Auto-generated' : (selectedRow['Booking Id'] || '—')} disabled />
                                    </div>
                                    <div>
                                        <label>Booking Date</label>
                                        <input type="date" value={fmtDate(selectedRow['Date'])} onChange={e => set('Date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Guest Name *</label>
                                        <input type="text" placeholder="e.g. John Doe" value={selectedRow['Guest Name'] || ''} onChange={e => set('Guest Name', e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Email</label>
                                        <input type="email" placeholder="guest@example.com" value={selectedRow['Email'] || ''} onChange={e => set('Email', e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Phone Number</label>
                                        <input type="tel" placeholder="10-digit phone" value={selectedRow['Phone Number'] || ''} onChange={e => set('Phone Number', e.target.value)} />
                                    </div>
                                    <div />
                                </>
                            )}
                        </div>

                        {/* Stay Details */}
                        <div className="modal-section-label">Stay Details</div>
                        <div className="modal-grid">
                            {modalMode === 'view' ? (
                                <>
                                    <div>
                                        <label>Check In Date</label>
                                        <input type="date" value={fmtDate(selectedRow['Check In Date'])} disabled />
                                    </div>
                                    <div>
                                        <label>Check Out Date</label>
                                        <input type="date" value={fmtDate(selectedRow['Check Out Date'])} disabled />
                                    </div>
                                    <ViewField label="Guest Count"    value={selectedRow['Guest Count']} />
                                    <ViewField label="Guest Adults"   value={selectedRow['Guest Adults']} />
                                    <ViewField label="Guest Children" value={selectedRow['Guest Children']} />
                                    <ViewField label="Booking Type"   value={selectedRow['Booking Type']} />
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label>Check In Date *</label>
                                        <input
                                            type="date"
                                            min={modalMode === 'add' ? todayStr : (selectedRow['Check In Date'] && fmtDate(selectedRow['Check In Date']) < todayStr ? fmtDate(selectedRow['Check In Date']) : todayStr)}
                                            value={fmtDate(selectedRow['Check In Date'])}
                                            style={conflictInfo ? { border: '1.5px solid #ef4444', backgroundColor: '#fff5f5' } : undefined}
                                            onChange={e => handleCheckInChange(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label>Check Out Date *</label>
                                        <input
                                            type="date"
                                            min={getMinCheckOut(selectedRow['Check In Date'])}
                                            value={fmtDate(selectedRow['Check Out Date'])}
                                            style={conflictInfo ? { border: '1.5px solid #ef4444', backgroundColor: '#fff5f5' } : undefined}
                                            onChange={e => set('Check Out Date', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label>Guest Adults</label>
                                        <input type="number" min="1" value={selectedRow['Guest Adults'] ?? 2} onChange={e => {
                                            const adults = Number(e.target.value) || 1;
                                            const children = Number(selectedRow['Guest Children'] || 0);
                                            setSelectedRow(r => ({ ...r, 'Guest Adults': adults, 'Guest Count': adults + children }));
                                        }} />
                                    </div>
                                    <div>
                                        <label>Guest Children</label>
                                        <input type="number" min="0" value={selectedRow['Guest Children'] ?? 0} onChange={e => {
                                            const children = Number(e.target.value) || 0;
                                            const adults = Number(selectedRow['Guest Adults'] || 1);
                                            setSelectedRow(r => ({ ...r, 'Guest Children': children, 'Guest Count': adults + children }));
                                        }} />
                                    </div>
                                    <div>
                                        <label>Total Guests Count</label>
                                        <input type="number" value={selectedRow['Guest Count'] ?? 2} disabled />
                                    </div>
                                    <div>
                                        <label>Booking Type</label>
                                        <select value={selectedRow['Booking Type'] || 'full villa'} onChange={e => set('Booking Type', e.target.value)}>
                                            <option value="full villa">Full Villa</option>
                                            <option value="half villa">Half Villa</option>
                                            <option value="remaining">Remaining Room</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Conflict Warning Message with Booking ID and Guest Name */}
                        {conflictInfo && (
                            <div style={{
                                marginTop: '14px',
                                background: '#fff5f5',
                                border: '1.5px solid #ef4444',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                color: '#991b1b',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.08)'
                            }}>
                                <div style={{ fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <AlertTriangle size={18} color="#dc2626" />
                                    <span>Already booked at that particular date!</span>
                                </div>
                                <div style={{ fontSize: '0.86rem', lineHeight: '1.5', color: '#7f1d1d' }}>
                                    Already booked by <strong>{conflictInfo.guestName}</strong> with Booking ID:{' '}
                                    <span style={{
                                        fontWeight: '700',
                                        color: '#991b1b',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {conflictInfo.bookingId}
                                    </span>
                                    <div style={{ marginTop: '4px', color: '#555' }}>
                                        <strong>Existing Stay:</strong> {conflictInfo.checkIn} to {conflictInfo.checkOut} ({conflictInfo.bookingType})
                                    </div>
                                </div>
                            </div>
                        )}

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
                                <select value={selectedRow['Status'] || 'Enquery'} disabled={modalMode === 'view'}
                                    onChange={e => set('Status', e.target.value)}>
                                    <option value="Enquery">Enquery</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="booked">Booked</option>
                                    <option value="pending">Pending</option>
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
                        {modalMode === 'view' ? (
                            <div className="notes-container">
                                {parsedNotes.length === 0 ? (
                                    <div className="notes-empty">No notes recorded for this booking.</div>
                                ) : (
                                    <ul className="notes-list">
                                        {parsedNotes.map((item, idx) => (
                                            <li key={idx} className="notes-item">
                                                <span className="notes-bullet">•</span>
                                                <div className="notes-content">
                                                    {item.date && (
                                                        <span className="notes-date-tag">
                                                            {item.date}
                                                        </span>
                                                    )}
                                                    <span className="notes-text">{item.text}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <>
                                {parsedNotes.length > 0 && (
                                    <div className="notes-container" style={{ marginBottom: '10px' }}>
                                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Notes History
                                        </div>
                                        <ul className="notes-list">
                                            {parsedNotes.map((item, idx) => (
                                                <li key={idx} className="notes-item">
                                                    <span className="notes-bullet">•</span>
                                                    <div className="notes-content">
                                                        {item.date && (
                                                            <span className="notes-date-tag">
                                                                {item.date}
                                                            </span>
                                                        )}
                                                        <span className="notes-text">{item.text}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <textarea
                                        rows={3}
                                        value={selectedRow['Notes'] || ''}
                                        placeholder="Enter notes (each line will be formatted as a bullet point)..."
                                        onChange={e => set('Notes', e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </>
                        )}

                        <div className="modal-actions">
                            {(modalMode === 'edit' || modalMode === 'add') && (
                                <button
                                    type="button"
                                    className="btn btn-success"
                                    disabled={saving || !!conflictInfo}
                                    onClick={handleSaveBooking}
                                    title={conflictInfo ? `Already booked by ${conflictInfo.guestName} (${conflictInfo.bookingId})` : undefined}
                                    style={{
                                        backgroundColor: conflictInfo ? '#94a3b8' : '#2C5F2D',
                                        cursor: conflictInfo ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {saving ? 'Saving...' : modalMode === 'add' ? 'Create Booking' : 'Save Changes'}
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={closeModal}
                                style={{ backgroundColor: '#A8BBA3' }}
                            >
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

const canEdit = (status) => {
    const s = String(status || '').toLowerCase();
    return ['enquiry', 'enquery', 'pending', 'booked', 'confirmed'].includes(s);
};

const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'booked' || s === 'visited' || s === 'confirmed') return '#16a34a';
    if (s === 'pending' || s === 'enquiry' || s === 'enquery') return '#d97706';
    if (s === 'cancelled' || s === 'failed') return '#dc2626';
    return '#334155';
};
