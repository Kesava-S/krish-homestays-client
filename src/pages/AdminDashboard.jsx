import React, { useState, useEffect, useContext, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../components/BookingForm.css';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import API_URL from '../config';
import { authContext } from '../App';
import { parseApiResponse } from '../utils/apiHelper';

const AdminDashboard = () => {
    const { token, setToken } = useContext(authContext);

    const [dateRange, setDateRange] = useState(null);
    const [calendarData, setCalendarData] = useState({ bookedRanges: [], rules: {} });
    const [price, setPrice] = useState(7000);
    const [status, setStatus] = useState('available');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const lastSelectedDateStr = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            navigate('/admin');
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/calendar-data`);
            const data = await parseApiResponse(res, 'Failed to fetch calendar data');
            setCalendarData(data || { bookedRanges: [], rules: {} });
        } catch (err) {
            console.error('Failed to fetch calendar data:', err);
        }
    };

    const parseLocalDate = (dateVal) => {
        if (!dateVal) return null;
        if (dateVal instanceof Date) {
            const d = new Date(dateVal);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const parts = String(dateVal).split('T')[0].split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
        }
        const d = new Date(dateVal);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const getBookedInfoForDate = (date) => {
        if (!date) return null;
        const d = parseLocalDate(date);
        if (!d) return null;
        const dateStr = format(d, 'yyyy-MM-dd');

        // Check bookedRanges (website, airbnb, mmt)
        for (const b of (calendarData.bookedRanges || [])) {
            const start = parseLocalDate(b.start);
            const end   = parseLocalDate(b.end);
            if (!start || !end) continue;
            if (d >= start && d < end) {
                return {
                    isBooked: true,
                    type: 'booking',
                    date: dateStr,
                    bookingId: b.booking_id || null,
                    guestName: b.guest_name || (b.type === 'airbnb' ? 'Airbnb Guest' : b.type === 'mmt' ? 'MakeMyTrip Guest' : 'Confirmed Guest'),
                    phone: b.phone || null,
                    email: b.email || null,
                    source: b.source || b.type || 'website',
                    roomType: b.room_type || b.booking_type || 'full villa',
                    start: b.start,
                    end: b.end,
                    status: b.status || 'confirmed'
                };
            }
        }

        // Check rules table for rule-based booked
        const rule = calendarData.rules?.[dateStr];
        if (rule && rule.status === 'booked') {
            return {
                isBooked: true,
                type: 'rule_booked',
                date: dateStr,
                bookingId: rule.booking_id || null,
                guestName: 'Manual Booking / Admin Rule Block',
                reason: rule.reason || 'Marked as booked by admin rule',
                ruleId: rule.rule_id || rule.id,
                status: 'booked'
            };
        }

        return null;
    };

    const getSelectedRangeDetails = () => {
        if (!dateRange || !dateRange[0]) return null;
        const start = new Date(dateRange[0]);
        const end = dateRange[1] || dateRange[0];
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const allDates = [];
        const bookedDates = [];
        const availableDates = [];

        const curr = new Date(start);
        while (curr <= end) {
            const info = getBookedInfoForDate(curr);
            const dateStr = format(curr, 'yyyy-MM-dd');
            const rule = calendarData.rules?.[dateStr];
            const item = {
                date: dateStr,
                displayDate: format(curr, 'MMM dd, yyyy'),
                bookedInfo: info,
                rule: rule
            };
            allDates.push(item);
            if (info) {
                bookedDates.push(item);
            } else {
                availableDates.push(item);
            }
            curr.setDate(curr.getDate() + 1);
        }

        return {
            allDates,
            bookedDates,
            availableDates,
            hasBooked: bookedDates.length > 0,
            allBooked: bookedDates.length === allDates.length
        };
    };

    // Auto-populate price/status from existing rule when selecting a new date/range
    useEffect(() => {
        if (dateRange && dateRange[0]) {
            const dateStr = format(dateRange[0], 'yyyy-MM-dd');
            // Only auto-populate when the start date actually changes to avoid wiping typed input when picking range end
            if (lastSelectedDateStr.current !== dateStr) {
                lastSelectedDateStr.current = dateStr;
                const rule = calendarData.rules?.[dateStr];
                if (rule?.price) {
                    setPrice(rule.price);
                } else {
                    setPrice(7000);
                }
                if (rule?.status) {
                    setStatus(rule.status);
                } else {
                    setStatus('available');
                }
            }
        } else {
            lastSelectedDateStr.current = null;
        }
    }, [dateRange]);

    const handleUpdate = async () => {
        if (!dateRange) return;

        const details = getSelectedRangeDetails();
        if (!details) return;

        if (details.allBooked) {
            setMessage('Cannot update rules: All selected dates are already booked. Rules cannot override confirmed bookings.');
            return;
        }

        setLoading(true);
        setMessage('');

        const numericPrice = Number(price);
        const finalPrice = !isNaN(numericPrice) && numericPrice > 0 ? numericPrice : 7000;

        // Only update dates that are NOT already booked
        const datesToUpdate = details.availableDates.map(item => ({
            date: item.date,
            price: finalPrice,
            status: status
        }));

        try {
            const res = await fetch(`${API_URL}/api/admin/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: datesToUpdate })
            });

            const data = await parseApiResponse(res, 'Update failed');
            if (details.hasBooked) {
                setMessage(`Updated ${datesToUpdate.length} available date(s). ${details.bookedDates.length} booked date(s) were protected and unchanged.`);
            } else {
                setMessage(data.message || 'Updated successfully!');
            }
            await fetchData(); // Refresh calendar data
        } catch (err) {
            setMessage(err.message || 'Server error.');
        } finally {
            setLoading(false);
        }
    };

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules?.[dateStr];
        const bookedInfo = getBookedInfoForDate(date);

        if (bookedInfo) return <div style={{ color: '#dc2626', fontWeight: '700', fontSize: '0.72rem' }}>Booked</div>;
        if (rule?.status === 'blocked') return <div style={{ color: '#6b7280', fontWeight: '600', fontSize: '0.72rem' }}>Blocked</div>;
        if (rule?.price) return <div style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.72rem' }}>₹{rule.price}</div>;
        return <div style={{ color: '#888', fontSize: '0.72rem' }}>₹7000</div>;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handleDateRangeChange = (val) => {
        if (!val) {
            setDateRange(null);
            return;
        }
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        if (Array.isArray(val)) {
            const start = val[0] < todayDate ? todayDate : val[0];
            const end = val[1] ? (val[1] < start ? start : val[1]) : start;
            setDateRange([start, end]);
        } else if (val instanceof Date) {
            const safe = val < todayDate ? todayDate : val;
            setDateRange([safe, safe]);
        } else {
            setDateRange(val);
        }
    };

    return (
        <div className="container">
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Calendar Management</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                            Manage villa availability, view confirmed bookings, and set custom prices per night.
                        </p>
                    </div>
                </div>

                <div className="grid-2">
                    <div className="calendar-section">
                        <Calendar
                            selectRange={true}
                            onChange={handleDateRangeChange}
                            value={dateRange}
                            tileContent={getTileContent}
                            minDate={today}
                            tileDisabled={({ date }) => date < today}
                            className="custom-calendar"
                        />
                    </div>

                    <div>
                        <h3>Manage Availability & Price</h3>
                        <p className="mb-4">Select a date range on the calendar to view or update rules.</p>

                        {dateRange && (() => {
                            const details = getSelectedRangeDetails();
                            if (!details) return null;
                            const { allDates, bookedDates, availableDates, hasBooked, allBooked } = details;

                            return (
                                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ paddingBottom: '12px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                                            <strong>Check-in:</strong> {format(dateRange[0], 'MMM dd, yyyy')} &nbsp;—&nbsp; 
                                            <strong>Check-out:</strong> {dateRange[1] ? format(dateRange[1], 'MMM dd, yyyy') : format(dateRange[0], 'MMM dd, yyyy')}
                                            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                                                ({allDates.length} day{allDates.length > 1 ? 's' : ''})
                                            </span>
                                        </p>
                                    </div>

                                    {/* CASE 1: ALL SELECTED DATES ARE ALREADY BOOKED */}
                                    {allBooked && (
                                        <div style={{
                                            background: '#fef2f2',
                                            border: '1.5px solid #f87171',
                                            borderRadius: '10px',
                                            padding: '16px',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '700', fontSize: '1rem', marginBottom: '8px' }}>
                                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626' }}></span>
                                                Already Booked Date — Rule Protection Active
                                            </div>
                                            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                                                This date is already booked. <strong>Rule-based availability and price updates cannot override active bookings.</strong>
                                            </p>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {bookedDates.map((item, idx) => (
                                                    <div key={idx} style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.88rem' }}>{item.displayDate}</span>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '4px' }}>
                                                                {item.bookedInfo?.type === 'rule_booked' ? 'Rule Booked' : 'Confirmed Booking'}
                                                            </span>
                                                        </div>
                                                        {item.bookedInfo?.bookingId && (
                                                            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '2px' }}>
                                                                <strong>Booking ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#b91c1c' }}>{item.bookedInfo.bookingId}</span>
                                                            </div>
                                                        )}
                                                        {item.bookedInfo?.guestName && (
                                                            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '2px' }}>
                                                                <strong>Guest:</strong> {item.bookedInfo.guestName}
                                                            </div>
                                                        )}
                                                        {item.bookedInfo?.roomType && (
                                                            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '2px' }}>
                                                                <strong>Room Type:</strong> {item.bookedInfo.roomType}
                                                            </div>
                                                        )}
                                                        {item.bookedInfo?.source && (
                                                            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '2px' }}>
                                                                <strong>Source:</strong> {item.bookedInfo.source}
                                                            </div>
                                                        )}
                                                        {item.bookedInfo?.reason && (
                                                            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                                                                <strong>Reason:</strong> {item.bookedInfo.reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Lock size={14} color="#991b1b" />
                                                <span>To view or modify this booking, visit the <strong>Bookings</strong> tab.</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* CASE 2: MIXED DATES (SOME BOOKED, SOME AVAILABLE) */}
                                    {hasBooked && !allBooked && (
                                        <div style={{
                                            background: '#fffbeb',
                                            border: '1.5px solid #f59e0b',
                                            borderRadius: '10px',
                                            padding: '16px',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: '700', fontSize: '0.95rem', marginBottom: '8px' }}>
                                                <AlertTriangle size={18} color="#d97706" />
                                                Already Booked Date(s) in Range
                                            </div>
                                            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#78350f', lineHeight: '1.4' }}>
                                                The selected range includes <strong>{bookedDates.length} booked date(s)</strong> that cannot be modified by rules:
                                            </p>
                                            <div style={{ background: '#ffffff', borderRadius: '6px', padding: '10px', border: '1px solid #fde68a', fontSize: '0.82rem', color: '#451a03' }}>
                                                {bookedDates.map((item, idx) => (
                                                    <div key={idx} style={{ marginBottom: idx < bookedDates.length - 1 ? '4px' : '0' }}>
                                                        • <strong>{item.displayDate}:</strong> Booked by {item.bookedInfo?.guestName} {item.bookedInfo?.bookingId ? `(${item.bookedInfo.bookingId})` : ''}
                                                    </div>
                                                ))}
                                            </div>
                                            <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: '#92400e', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckCircle2 size={14} color="#166534" />
                                                Rule changes will only apply to the <strong>{availableDates.length} available date(s)</strong> ({availableDates.map(a => a.displayDate).join(', ')}). Booked dates will remain preserved.
                                            </p>
                                        </div>
                                    )}

                                    {/* CASE 3: DISPLAY CURRENT RULE INFORMATION IF ALL AVAILABLE */}
                                    {!hasBooked && (
                                        <div style={{
                                            background: '#f0fdf4',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '8px',
                                            padding: '12px 14px',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckCircle2 size={15} color="#166534" />
                                                Available for Rule Configuration
                                            </div>
                                            {allDates.length === 1 && allDates[0].rule ? (
                                                <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                                                    Current Rule: Status: <strong>{allDates[0].rule.status}</strong>
                                                    {allDates[0].rule.price && ` • Price: ₹${Number(allDates[0].rule.price).toLocaleString()}`}
                                                    {allDates[0].rule.reason && ` • Reason: ${allDates[0].rule.reason}`}
                                                </div>
                                            ) : allDates.length > 1 ? (
                                                <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                                                    {allDates.some(d => d.rule?.price)
                                                        ? `Current prices in range: ${allDates.map(d => `${d.date.slice(5)}: ₹${d.rule?.price ? Number(d.rule.price).toLocaleString() : '7,000'}`).join(', ')}`
                                                        : `All ${allDates.length} selected dates currently use the default price (₹7,000 / night)`
                                                    }
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* RULE INPUT FORM */}
                                    {!allBooked ? (
                                        <>
                                            <div className="form-group">
                                                <label style={{ fontWeight: '600', fontSize: '0.88rem' }}>Price per Night (₹)</label>
                                                <input
                                                    type="number"
                                                    value={price}
                                                    onChange={e => setPrice(e.target.value)}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label style={{ fontWeight: '600', fontSize: '0.88rem' }}>Status</label>
                                                <select value={status} onChange={e => setStatus(e.target.value)}>
                                                    <option value="available">Available</option>
                                                    <option value="blocked">Blocked (Maintenance / Personal)</option>
                                                    <option value="booked">Booked (Manual)</option>
                                                </select>
                                            </div>

                                            <button
                                                onClick={handleUpdate}
                                                disabled={loading || availableDates.length === 0}
                                                className="btn btn-primary mt-4"
                                                style={{ width: '100%', fontWeight: '600' }}
                                            >
                                                {loading 
                                                    ? 'Updating...' 
                                                    : hasBooked 
                                                        ? `Update ${availableDates.length} Available Date${availableDates.length > 1 ? 's' : ''}` 
                                                        : 'Update Selected Dates'}
                                            </button>
                                        </>
                                    ) : (
                                        <div style={{ marginTop: '10px' }}>
                                            <button
                                                type="button"
                                                disabled
                                                className="btn btn-secondary"
                                                style={{ width: '100%', cursor: 'not-allowed', opacity: 0.65, fontWeight: '600' }}
                                            >
                                                Rule Cannot Override Booked Dates
                                            </button>
                                        </div>
                                    )}

                                    {message && (
                                        <p className="mt-3 text-center" style={{
                                            fontSize: '0.88rem',
                                            fontWeight: '600',
                                            color: message.includes('failed') || message.includes('Cannot') ? '#dc2626' : '#16a34a'
                                        }}>
                                            {message}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
