import React, { useState, useEffect, useContext } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import { authContext } from '../App';

const AdminDashboard = () => {

    const { token, setToken } = useContext(authContext);

    const [dateRange, setDateRange] = useState(null);
    const [calendarData, setCalendarData] = useState({ bookedRanges: [], rules: {} });
    const [price, setPrice] = useState(7000);
    const [status, setStatus] = useState('available');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin');
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/calendar-data`);
            const data = await res.json();
            setCalendarData(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdate = async () => {
        if (!dateRange) return;

        setLoading(true);
        setMessage('');

        // Generate dates in range
        const datesToUpdate = [];
        let current = new Date(dateRange[0]);
        const end = dateRange[1] || dateRange[0]; // Handle single date selection

        while (current <= end) {
            datesToUpdate.push({
                date: format(current, 'yyyy-MM-dd'),
                price: parseInt(price),
                status: status
            });
            current.setDate(current.getDate() + 1);
        }

        try {
            const res = await fetch(`${API_URL}/api/admin/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: datesToUpdate })
            });

            if (res.ok) {
                setMessage('Updated successfully!');
                fetchData(); // Refresh
            } else {
                setMessage('Update failed.');
            }
        } catch (err) {
            setMessage('Server error.');
        } finally {
            setLoading(false);
        }
    };

    const getTileContent = ({ date, view }) => {
        if (view !== 'month') return null;
        const dateStr = format(date, 'yyyy-MM-dd');
        const rule = calendarData.rules[dateStr];

        // Check if booked
        const isBooked = calendarData.bookedRanges.some(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            // Reset times
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d >= start && d < end;
        });

        if (isBooked) return <div style={{ fontSize: '10px', color: 'red' }}>Booked</div>;

        if (rule) {
            return (
                <div style={{ fontSize: '10px', color: rule.status === 'blocked' ? 'gray' : 'green' }}>
                    {rule.status === 'blocked' ? 'Blocked' : `₹${rule.price}`}
                </div>
            );
        }

        return <div style={{ fontSize: '10px', color: '#888' }}>₹7000</div>;
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        setToken(null);
        navigate('/admin')
    }

    return (
        <div className="container">
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Admin Dashboard</h2>
                    <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                    <div>
                        <Calendar
                            selectRange={true}
                            onChange={setDateRange}
                            value={dateRange}
                            tileContent={getTileContent}
                            className="custom-calendar"
                        />
                    </div>

                    <div>
                        <h3>Manage Availability & Price</h3>
                        <p className="mb-4">Select a date range on the calendar to update.</p>

                        {dateRange && (
                            <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px' }}>
                                <p><strong>Selected:</strong> {format(dateRange[0], 'MMM dd')} - {dateRange[1] ? format(dateRange[1], 'MMM dd') : format(dateRange[0], 'MMM dd')}</p>

                                <div className="form-group mt-4">
                                    <label>Price per Night (₹)</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)}>
                                        <option value="available">Available</option>
                                        <option value="blocked">Blocked (Maintenance/Personal)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleUpdate}
                                    disabled={loading}
                                    className="btn btn-primary mt-4"
                                    style={{ width: '100%' }}
                                >
                                    {loading ? 'Updating...' : 'Update Selected Dates'}
                                </button>
                                {message && <p className="mt-2 text-center">{message}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
