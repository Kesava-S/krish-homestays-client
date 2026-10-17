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
    const [selectionStage, setSelectionStage] = useState('idle'); // 'idle' | 'start_selected' | 'completed'
    const [calendarData, setCalendarData] = useState({ bookedRanges: [], rules: {} });
    const [priceFull, setPriceFull] = useState(7000);
    const [pricePartial, setPricePartial] = useState(5000);
    const [status, setStatus] = useState('available');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const lastSelectedDateStr = useRef(null);
    const lastClickRef = useRef({ dateStr: null, time: 0 });
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

    const isSameDay = (d1, d2) => {
        if (!d1 || !d2) return false;
        const a = new Date(d1); a.setHours(0, 0, 0, 0);
        const b = new Date(d2); b.setHours(0, 0, 0, 0);
        return a.getTime() === b.getTime();
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

    // Auto-populate prices/status from existing rule when selecting a new date/range
    useEffect(() => {
        if (dateRange && dateRange[0]) {
            const dateStr = format(dateRange[0], 'yyyy-MM-dd');
            // Only auto-populate when the start date actually changes
            if (lastSelectedDateStr.current !== dateStr) {
                lastSelectedDateStr.current = dateStr;
                const rule = calendarData.rules?.[dateStr];

                // Full Villa price
                if (rule?.price !== undefined && rule?.price !== null && rule?.price !== '') {
                    setPriceFull(rule.price);
                } else {
                    setPriceFull(7000);
                }

                // Exclude One Room (partial villa) price
                if (rule?.partial_price !== undefined && rule?.partial_price !== null && rule?.partial_price !== '') {
                    setPricePartial(rule.partial_price);
                } else if (rule?.price) {
                    const fp = Number(rule.price);
                    setPricePartial(fp < 5000 ? fp : Math.round(fp * (5000 / 7000)));
                } else {
                    setPricePartial(5000);
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
    }, [dateRange, calendarData]);

    const handleDayClick = (clickedDate, event) => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const d = new Date(clickedDate);
        d.setHours(0, 0, 0, 0);
        if (d < todayDate) return;

        const dStr = format(d, 'yyyy-MM-dd');
        const now = Date.now();
        const prev = lastClickRef.current;
        const timeDiff = now - prev.time;
        const isSameAsLastClick = prev.dateStr === dStr;

        // Detect double click: clicked same date quickly (< 380ms) OR native event.detail === 2
        const isDoubleClick = (event && event.detail === 2) || (isSameAsLastClick && timeDiff < 380);

        // Update click ref
        lastClickRef.current = { dateStr: dStr, time: now };

        // Case 1: Double click -> select single day [d, d]
        if (isDoubleClick) {
            setDateRange([d, d]);
            setSelectionStage('completed');
            return;
        }

        // Case 2: Click same date after some seconds (NOT double click) -> UNSELECT that date
        if (dateRange && (isSameDay(d, dateRange[0]) || (dateRange[1] && isSameDay(d, dateRange[1])))) {
            if (timeDiff >= 380) {
                setDateRange(null);
                setSelectionStage('idle');
                lastClickRef.current = { dateStr: null, time: 0 };
                return;
            }
        }

        // Case 3: In 'start_selected' stage and user clicks a DIFFERENT date -> set "to" date (range selection)
        if (selectionStage === 'start_selected' && dateRange && dateRange[0] && !isSameDay(d, dateRange[0])) {
            const start = d < dateRange[0] ? d : dateRange[0];
            const end = d < dateRange[0] ? dateRange[0] : d;
            setDateRange([start, end]);
            setSelectionStage('completed');
            return;
        }

        // Case 4: First click (from idle or completed state) -> select "from" date
        setDateRange([d, d]);
        setSelectionStage('start_selected');
    };

    const handleUpdate = async () => {
        if (!dateRange || !dateRange[0]) return;

        const details = getSelectedRangeDetails();
        if (!details) return;

        if (details.allBooked) {
            setMessage('Cannot update rules: All selected dates are already booked. Rules cannot override confirmed bookings.');
            return;
        }

        setLoading(true);
        setMessage('');

        const numericFullPrice = Number(priceFull);
        const finalFullPrice = !isNaN(numericFullPrice) && numericFullPrice > 0 ? numericFullPrice : 7000;

        const numericPartialPrice = Number(pricePartial);
        const finalPartialPrice = !isNaN(numericPartialPrice) && numericPartialPrice > 0 ? numericPartialPrice : 5000;

        // Create both full villa and partial villa rules for all available dates
        const datesToUpdate = [];
        details.availableDates.forEach(item => {
            // Full villa rule
            datesToUpdate.push({
                date: item.date,
                price: finalFullPrice,
                status: status,
                unit: 'full_villa',
                room_type: 'full'
            });
            // Exclude one room (partial villa) rule
            datesToUpdate.push({
                date: item.date,
                price: finalPartialPrice,
                status: status,
                unit: 'half_villa',
                room_type: 'partial'
            });
        });

        try {
            const res = await fetch(`${API_URL}/api/admin/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: datesToUpdate })
            });

            const data = await parseApiResponse(res, 'Update failed');
            if (details.hasBooked) {
                setMessage(`Updated ${details.availableDates.length} available date(s). ${details.bookedDates.length} booked date(s) were protected and unchanged.`);
            } else {
                setMessage(data.message || `Successfully updated ${details.availableDates.length} date(s)!`);
            }
            await fetchData(); // Refresh calendar data
        } catch (err) {
            setMessage(err.message || 'Server error.');
        } finally {
            setLoading(false);
        }
    };

    const getTileClassName = ({ date, view }) => {
        if (view !== 'month' || !dateRange || !dateRange[0]) return '';
        const d = new Date(date); d.setHours(0, 0, 0, 0);
        const s = new Date(dateRange[0]); s.setHours(0, 0, 0, 0);
        const e = dateRange[1] ? new Date(dateRange[1]) : s;
        e.setHours(0, 0, 0, 0);

        const dTime = d.getTime();
        const sTime = s.getTime();
        const eTime = e.getTime();

        if (dTime === sTime && dTime === eTime) {
            return 'cal-selected-single';
        }
        if (dTime === sTime) {
            return 'cal-selected-start';
        }
        if (dTime === eTime) {
            return 'cal-selected-end';
        }
        if (dTime > sTime && dTime < eTime) {
            return 'cal-selected-between';
        }
        return '';
    };

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules?.[dateStr];
        const bookedInfo = getBookedInfoForDate(date);

        if (bookedInfo) return <div style={{ color: '#dc2626', fontWeight: '700', fontSize: '0.72rem' }}>Booked</div>;
        if (rule?.status === 'blocked') return <div style={{ color: '#6b7280', fontWeight: '600', fontSize: '0.72rem' }}>Blocked</div>;
        
        const fullP = rule?.price ? Number(rule.price) : 7000;
        const partP = rule?.partial_price 
            ? Number(rule.partial_price) 
            : (rule?.price ? (rule.price < 5000 ? rule.price : Math.round(Number(rule.price) * (5000 / 7000))) : 5000);
        
        const isCustom = !!(rule?.price || rule?.partial_price);

        return (
            <div style={{ fontSize: '0.7rem', lineHeight: '1.2', marginTop: '2px' }}>
                <div style={{ color: isCustom ? '#16a34a' : '#475569', fontWeight: isCustom ? '700' : '600' }}>
                    ₹{fullP}
                </div>
                <div style={{ color: isCustom ? '#0284c7' : '#94a3b8', fontSize: '0.62rem', fontWeight: isCustom ? '600' : '500' }}>
                    ₹{partP}
                </div>
            </div>
        );
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
                            selectRange={false}
                            onClickDay={handleDayClick}
                            value={dateRange}
                            tileContent={getTileContent}
                            tileClassName={getTileClassName}
                            minDate={today}
                            tileDisabled={({ date }) => date < today}
                            className="custom-calendar"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#64748b', marginTop: '10px', padding: '6px 8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '6px' }}>
                            <div>
                                <span style={{ fontWeight: '600', color: '#16a34a' }}>Top:</span> Full Villa &nbsp;|&nbsp; 
                                <span style={{ fontWeight: '600', color: '#0284c7', marginLeft: '4px' }}>Bottom:</span> Exclude 1 Room
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                Single click: range &nbsp;•&nbsp; Double click: 1 day &nbsp;•&nbsp; Click again: unselect
                            </div>
                        </div>
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
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                                                <strong>Check-in:</strong> {format(dateRange[0], 'MMM dd, yyyy')} &nbsp;—&nbsp; 
                                                <strong>Check-out:</strong> {dateRange[1] ? format(dateRange[1], 'MMM dd, yyyy') : format(dateRange[0], 'MMM dd, yyyy')}
                                                <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                                                    ({allDates.length} day{allDates.length > 1 ? 's' : ''})
                                                </span>
                                            </p>
                                            {selectionStage === 'start_selected' && (
                                                <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
                                                    From date selected — click another date for To date
                                                </span>
                                            )}
                                        </div>
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
                                                    {allDates[0].rule.price && ` • Full Villa: ₹${Number(allDates[0].rule.price).toLocaleString()}`}
                                                    {allDates[0].rule.partial_price && ` • Exclude 1 Room: ₹${Number(allDates[0].rule.partial_price).toLocaleString()}`}
                                                    {allDates[0].rule.reason && ` • Reason: ${allDates[0].rule.reason}`}
                                                </div>
                                            ) : allDates.length > 1 ? (
                                                <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                                                    {allDates.some(d => d.rule?.price || d.rule?.partial_price)
                                                        ? `Configuring rules for ${allDates.length} selected dates (some have custom pricing).`
                                                        : `All ${allDates.length} selected dates currently use default rates (Full: ₹7,000, Exclude 1 Room: ₹5,000 / night).`
                                                    }
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* RULE INPUT FORM */}
                                    {!allBooked ? (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontWeight: '600', fontSize: '0.88rem', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                                                        Full Villa Price (₹)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="100"
                                                        value={priceFull}
                                                        onChange={e => setPriceFull(e.target.value)}
                                                        placeholder="7000"
                                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                                    />
                                                    <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>Default: ₹7,000 / night</span>
                                                </div>

                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontWeight: '600', fontSize: '0.88rem', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                                                        Exclude One Room Price (₹)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="100"
                                                        value={pricePartial}
                                                        onChange={e => setPricePartial(e.target.value)}
                                                        placeholder="5000"
                                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                                    />
                                                    <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>Default: ₹5,000 / night</span>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label style={{ fontWeight: '600', fontSize: '0.88rem', color: '#1e293b', display: 'block', marginBottom: '6px' }}>Status</label>
                                                <select 
                                                    value={status} 
                                                    onChange={e => setStatus(e.target.value)}
                                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', background: '#fff' }}
                                                >
                                                    <option value="available">Available</option>
                                                    <option value="blocked">Blocked (Maintenance / Personal)</option>
                                                    <option value="booked">Booked (Manual)</option>
                                                </select>
                                            </div>

                                            <button
                                                onClick={handleUpdate}
                                                disabled={loading || availableDates.length === 0}
                                                className="btn btn-primary mt-4"
                                                style={{ width: '100%', fontWeight: '600', padding: '12px' }}
                                            >
                                                {loading 
                                                    ? 'Updating...' 
                                                    : hasBooked 
                                                        ? `Update ${availableDates.length} Available Date${availableDates.length > 1 ? 's' : ''}` 
                                                        : `Update ${availableDates.length} Selected Date${availableDates.length > 1 ? 's' : ''}`}
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
