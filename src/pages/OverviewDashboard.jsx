import React, { useState, useEffect } from 'react';
import { 
  Users, 
  IndianRupee, 
  CalendarCheck, 
  CalendarRange, 
  Clock, 
  Calendar,
  AlertCircle,
  ArrowRight, 
  CheckCircle2,
  ChevronRight,
  X,
  XCircle
} from 'lucide-react';
import { format, isSameDay, addDays } from 'date-fns';
import API_URL from '../config';
import { parseApiResponse } from '../utils/apiHelper';
import './OverviewDashboard.css';

// Global in-memory cache to ensure instant loading when switching/redirecting from any page
let dashboardCache = null;

export default function OverviewDashboard({ onNavigate, isActive = true }) {
  const [bookings, setBookings] = useState(() => dashboardCache?.bookings || []);
  const [rules, setRules] = useState(() => dashboardCache?.rules || []);
  const [loading, setLoading] = useState(() => !dashboardCache);
  const [filterTab, setFilterTab] = useState('next4'); // 'next4' | 'today' | 'tomorrow' | 'next7' | 'all'
  const [lastUpdated, setLastUpdated] = useState(() => dashboardCache?.lastUpdated || new Date());
  const [selectedBooking, setSelectedBooking] = useState(null);

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground && !dashboardCache) {
      setLoading(true);
    }
    try {
      const [bookingsRes, rulesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/bookings`).then(r => parseApiResponse(r, 'Failed to fetch bookings')),
        fetch(`${API_URL}/api/admin/calendar-rules`).then(r => parseApiResponse(r, 'Failed to fetch rules')).catch(() => [])
      ]);
      const nextBookings = Array.isArray(bookingsRes) ? bookingsRes : [];
      const nextRules = Array.isArray(rulesRes) ? rulesRes : [];
      const nextDate = new Date();

      dashboardCache = {
        bookings: nextBookings,
        rules: nextRules,
        lastUpdated: nextDate
      };

      setBookings(nextBookings);
      setRules(nextRules);
      setLastUpdated(nextDate);
    } catch (err) {
      console.error('Error fetching dashboard overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(Boolean(dashboardCache));
  }, []);

  useEffect(() => {
    if (isActive && dashboardCache) {
      fetchDashboardData(true);
    }
  }, [isActive]);

  // Today normalized
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Metrics Calculation ───────────────────────────────────────────
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'booked');
  const activeEnquiries = bookings.filter(b => b.status === 'enquiry');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  const totalRevenue = confirmedBookings.reduce((sum, b) => {
    const val = Number(b.total_amount || b['Total Amount'] || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalGuests = confirmedBookings.reduce((sum, b) => {
    const adults = Number(b.guest_adults || b.adults || b['Guest Adults'] || 0);
    const children = Number(b.guest_children || b.children || b['Guest Children'] || 0);
    const count = Number(b.guest_count || b.guests_count || b['Guest Count'] || (adults + children));
    return sum + (count || adults || 2);
  }, 0);

  // ── 4 Days & Upcoming Check-ins Calculation ───────────────────────
  const window4DaysEnd = new Date(today);
  window4DaysEnd.setDate(today.getDate() + 4);
  window4DaysEnd.setHours(23, 59, 59, 999);

  const window7DaysEnd = new Date(today);
  window7DaysEnd.setDate(today.getDate() + 7);
  window7DaysEnd.setHours(23, 59, 59, 999);

  // All upcoming bookings from today onwards
  const allUpcoming = bookings.filter(b => {
    const rawDate = b.check_in_date || b['Check In Date'];
    if (!rawDate) return false;
    const checkIn = new Date(rawDate);
    checkIn.setHours(0, 0, 0, 0);
    const isValidStatus = b.status === 'confirmed' || b.status === 'booked';
    return isValidStatus && checkIn >= today;
  }).sort((a, b) => new Date(a.check_in_date || a['Check In Date']) - new Date(b.check_in_date || b['Check In Date']));

  // Filter based on active tab
  const getFilteredCheckIns = () => {
    return allUpcoming.filter(b => {
      const checkIn = new Date(b.check_in_date || b['Check In Date']);
      checkIn.setHours(0, 0, 0, 0);

      if (filterTab === 'today') {
        return isSameDay(checkIn, today);
      }
      if (filterTab === 'tomorrow') {
        const tomorrow = addDays(today, 1);
        return isSameDay(checkIn, tomorrow);
      }
      if (filterTab === 'next4') {
        return checkIn >= today && checkIn <= window4DaysEnd;
      }
      if (filterTab === 'next7') {
        return checkIn >= today && checkIn <= window7DaysEnd;
      }
      return true; // 'all'
    });
  };

  const filteredGuests = getFilteredCheckIns();
  const next4DaysCount = allUpcoming.filter(b => {
    const checkIn = new Date(b.check_in_date || b['Check In Date']);
    checkIn.setHours(0, 0, 0, 0);
    return checkIn >= today && checkIn <= window4DaysEnd;
  }).length;


  const getArrivalBadge = (checkInDateStr) => {
    const d = new Date(checkInDateStr);
    d.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return (
        <span className="arrival-tag today">
          <AlertCircle size={14} />
          <span>Check-in Today</span>
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="arrival-tag tomorrow">
          <Clock size={14} />
          <span>Arriving Tomorrow</span>
        </span>
      );
    }
    return (
      <span className="arrival-tag upcoming">
        <Calendar size={14} />
        <span>In {diffDays} Days ({format(d, 'MMM dd')})</span>
      </span>
    );
  };

  const getStatusDisplay = (statusStr) => {
    const st = (statusStr || 'confirmed').toLowerCase();
    if (st === 'confirmed' || st === 'booked') {
      return (
        <span className="status-pill confirmed">
          <CheckCircle2 size={15} />
          <span>{statusStr || 'Confirmed'}</span>
        </span>
      );
    }
    if (st === 'enquiry') {
      return (
        <span className="status-pill enquiry">
          <Clock size={15} />
          <span>{statusStr || 'Enquiry'}</span>
        </span>
      );
    }
    if (st === 'cancelled') {
      return (
        <span className="status-pill cancelled">
          <XCircle size={15} />
          <span>{statusStr || 'Cancelled'}</span>
        </span>
      );
    }
    return (
      <span className="status-pill">
        <span>{statusStr}</span>
      </span>
    );
  };


  return (
    <div className="dashboard-container">
      {/* ── CLEAN HEADER ROW ── */}
      <div className="dashboard-header-clean">
        <h2 className="dashboard-title-heading">Dashboard Overview</h2>
        <div className="dashboard-header-right">
          <div className="dashboard-date-badge-clean">
            <Clock size={15} />
            <span>{format(lastUpdated, 'EEEE, MMMM dd, yyyy')}</span>
          </div>
          <button 
            type="button"
            onClick={() => onNavigate && onNavigate('calendar')} 
            className="btn-dashboard-action"
          >
            <CalendarRange size={15} />
            <span>Open Calendar</span>
          </button>
        </div>
      </div>

      {/* ── METRICS OVERVIEW CARDS ── */}
      <div className="metrics-grid">
        {/* Card 1: Confirmed Bookings */}
        <div className="metric-card emerald">
          <div className="metric-card-content">
            <div className="metric-title">Confirmed Bookings</div>
            {loading ? (
              <div className="metric-skeleton-shimmer"></div>
            ) : (
              <div className="metric-value">{confirmedBookings.length}</div>
            )}
          </div>
          <div className="metric-icon-box">
            <CalendarCheck size={24} />
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="metric-card blue">
          <div className="metric-card-content">
            <div className="metric-title">Total Revenue</div>
            {loading ? (
              <div className="metric-skeleton-shimmer"></div>
            ) : (
              <div className="metric-value">₹{totalRevenue.toLocaleString('en-IN')}</div>
            )}
          </div>
          <div className="metric-icon-box">
            <IndianRupee size={24} />
          </div>
        </div>

        {/* Card 3: Total Guests */}
        <div className="metric-card purple">
          <div className="metric-card-content">
            <div className="metric-title">Total Guests</div>
            {loading ? (
              <div className="metric-skeleton-shimmer"></div>
            ) : (
              <div className="metric-value">{totalGuests}</div>
            )}
          </div>
          <div className="metric-icon-box">
            <Users size={24} />
          </div>
        </div>

        {/* Card 5: Calendar Rules */}
        <div className="metric-card rose">
          <div className="metric-card-content">
            <div className="metric-title">Calendar Rules</div>
            {loading ? (
              <div className="metric-skeleton-shimmer"></div>
            ) : (
              <div className="metric-value">{rules.length}</div>
            )}
          </div>
          <div className="metric-icon-box">
            <CalendarRange size={24} />
          </div>
        </div>
      </div>

      {/* ── 4-DAY CHECK-IN GUESTS SECTION (CORE FEATURE) ── */}
      <div className="checkins-section">
        <div className="checkins-header">
          <div className="checkins-title-wrap">
            <h2>Upcoming Check-ins</h2>
            <span className="checkins-badge">
              <Clock size={13} />
              Next 4 Days ({loading ? '...' : next4DaysCount})
            </span>
          </div>

          <div className="checkins-filter-tabs">
            <button 
              type="button"
              className={`checkins-tab ${filterTab === 'next4' ? 'active' : ''}`}
              onClick={() => setFilterTab('next4')}
            >
              Next 4 Days ({loading ? '...' : next4DaysCount})
            </button>
            <button 
              type="button"
              className={`checkins-tab ${filterTab === 'today' ? 'active' : ''}`}
              onClick={() => setFilterTab('today')}
            >
              Today
            </button>
            <button 
              type="button"
              className={`checkins-tab ${filterTab === 'tomorrow' ? 'active' : ''}`}
              onClick={() => setFilterTab('tomorrow')}
            >
              Tomorrow
            </button>
            <button 
              type="button"
              className={`checkins-tab ${filterTab === 'next7' ? 'active' : ''}`}
              onClick={() => setFilterTab('next7')}
            >
              Next 7 Days
            </button>
            <button 
              type="button"
              className={`checkins-tab ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All Upcoming ({loading ? '...' : allUpcoming.length})
            </button>
          </div>
        </div>

        {/* Guests Table */}
        {loading ? (
          <div className="checkins-skeleton-container">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="checkins-skeleton-row">
                <div className="checkins-skeleton-cell" style={{ width: '40px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '110px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '150px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '120px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '100px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '90px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '90px' }}></div>
                <div className="checkins-skeleton-cell" style={{ width: '80px' }}></div>
              </div>
            ))}
          </div>
        ) : filteredGuests.length > 0 ? (
          <div className="checkins-table-container">
            <table className="checkins-table">
              <thead>
                <tr>
                  <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                  <th>Booking ID</th>
                  <th>Guest Name</th>
                  <th>Arrival</th>
                  <th>Check-In</th>
                  <th>Room Type</th>
                  <th>Guests</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((b, idx) => {
                  const checkInRaw = b.check_in_date || b['Check In Date'];
                  const checkOutRaw = b.check_out_date || b['Check Out Date'];
                  const guestName = b.guest_name || b['Guest Name'] || 'Guest';
                  const phone = b.phone || b.phone_number || b['Phone Number'];
                  const email = b.email || b['Email'];
                  const bId = b.booking_id || b['Booking Id'] || b['Booking ID'] || `BK-${idx + 1}`;
                  const adults = b.guest_adults || b.adults || b['Guest Adults'] || 2;
                  const children = b.guest_children || b.children || b['Guest Children'] || 0;
                  const roomType = b.room_type || b.booking_type || b['Booking Type'] || 'Full Villa';
                  const amount = b.total_amount || b['Total Amount'] || 0;
                  const isToday = isSameDay(new Date(checkInRaw), today);

                  return (
                    <tr key={bId || idx} className={isToday ? 'row-checkin-today' : ''}>
                      <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <button 
                          type="button"
                          className="table-booking-id-btn"
                          onClick={() => setSelectedBooking(b)}
                          title="Click to view booking details"
                        >
                          <span>#{bId}</span>
                          <ChevronRight size={13} className="booking-id-chevron" />
                        </button>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{guestName}</span>
                      </td>
                      <td>
                        {getArrivalBadge(checkInRaw)}
                      </td>
                      <td>
                        <strong style={{ color: '#1e293b' }}>
                          {format(new Date(checkInRaw), 'dd MMM yyyy')}
                        </strong>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>{roomType}</span>
                      </td>
                      <td>
                        <span>{adults} Adults {children > 0 ? `+ ${children} Kids` : ''}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: '#1e293b' }}>
                          {amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="checkins-empty-state">
            <div className="checkins-empty-icon">
              <CheckCircle2 size={28} />
            </div>
            <h3>No Check-ins Scheduled for {filterTab === 'next4' ? 'the Next 4 Days' : filterTab === 'today' ? 'Today' : filterTab === 'tomorrow' ? 'Tomorrow' : 'this period'}</h3>
            <p>
              {allUpcoming.length > 0 
                ? `The next scheduled arrival is ${allUpcoming[0].guest_name || 'Guest'} on ${format(new Date(allUpcoming[0].check_in_date || allUpcoming[0]['Check In Date']), 'MMMM dd, yyyy')}.`
                : 'There are currently no upcoming bookings scheduled. The villa is vacant and ready for new reservations.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setFilterTab('all')} 
                className="btn-dashboard-action"
                style={{ background: '#1e293b' }}
              >
                <span>View All Upcoming ({allUpcoming.length})</span>
              </button>
              <button 
                type="button" 
                onClick={() => onNavigate && onNavigate('calendar')} 
                className="btn-dashboard-action"
              >
                <CalendarRange size={15} />
                <span>Manage Availability</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BOOKING DETAILS MODAL CARD ── */}
      {selectedBooking && (
        <div className="booking-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
            <div className="booking-modal-header">
              <div>
                <span className="booking-modal-badge">Booking Details</span>
                <h3 className="booking-modal-title">
                  #{selectedBooking.booking_id || selectedBooking['Booking Id'] || selectedBooking['Booking ID']}
                </h3>
              </div>
              <button 
                type="button" 
                className="booking-modal-close-btn"
                onClick={() => setSelectedBooking(null)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="booking-modal-body">
              <div className="booking-modal-field">
                <span className="field-label">Guest Name</span>
                <span className="field-value font-bold">
                  {selectedBooking.guest_name || selectedBooking['Guest Name'] || 'Guest'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Arrival Status</span>
                <span className="field-value">
                  {getArrivalBadge(selectedBooking.check_in_date || selectedBooking['Check In Date'])}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Phone Number</span>
                <span className="field-value">
                  {selectedBooking.phone || selectedBooking.phone_number || selectedBooking['Phone Number'] || '—'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Email Address</span>
                <span className="field-value">
                  {selectedBooking.email || selectedBooking['Email'] || '—'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Check-In Date</span>
                <span className="field-value">
                  {selectedBooking.check_in_date || selectedBooking['Check In Date'] 
                    ? format(new Date(selectedBooking.check_in_date || selectedBooking['Check In Date']), 'EEEE, dd MMMM yyyy') 
                    : '—'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Check-Out Date</span>
                <span className="field-value">
                  {selectedBooking.check_out_date || selectedBooking['Check Out Date'] 
                    ? format(new Date(selectedBooking.check_out_date || selectedBooking['Check Out Date']), 'EEEE, dd MMMM yyyy') 
                    : '—'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Room Type</span>
                <span className="field-value capitalize">
                  {selectedBooking.room_type || selectedBooking.booking_type || selectedBooking['Booking Type'] || 'Full Villa'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Number of Guests</span>
                <span className="field-value">
                  {selectedBooking.guest_adults || selectedBooking.adults || selectedBooking['Guest Adults'] || 2} Adults
                  {Number(selectedBooking.guest_children || selectedBooking.children || selectedBooking['Guest Children'] || 0) > 0 
                    ? ` + ${selectedBooking.guest_children || selectedBooking.children || selectedBooking['Guest Children']} Kids` 
                    : ''}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Total Amount</span>
                <span className="field-value amount">
                  {(selectedBooking.total_amount || selectedBooking['Total Amount']) 
                    ? `₹${Number(selectedBooking.total_amount || selectedBooking['Total Amount']).toLocaleString('en-IN')}` 
                    : '—'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Booking Source</span>
                <span className="field-value capitalize">
                  {selectedBooking.source || 'Website'}
                </span>
              </div>

              <div className="booking-modal-field">
                <span className="field-label">Booking Status</span>
                {getStatusDisplay(selectedBooking.status)}
              </div>

              {(selectedBooking.notes || selectedBooking['Notes'] || selectedBooking.reason || selectedBooking['Reason']) && (
                <div className="booking-modal-field full-width">
                  <span className="field-label">Notes / Reason</span>
                  <span className="field-value">
                    {selectedBooking.notes || selectedBooking['Notes'] || selectedBooking.reason || selectedBooking['Reason']}
                  </span>
                </div>
              )}
            </div>

            <div className="booking-modal-footer">
              <button 
                type="button" 
                className="btn-modal-secondary"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn-modal-primary"
                onClick={() => {
                  setSelectedBooking(null);
                  if (onNavigate) onNavigate('bookings');
                }}
              >
                <span>View in Bookings Tab</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

