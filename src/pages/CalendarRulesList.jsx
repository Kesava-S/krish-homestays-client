import React, { useEffect, useState } from 'react';
import { Trash2, Plus, CalendarRange, RefreshCw } from 'lucide-react';
import './BookingList.css';
import Swal from 'sweetalert2';
import API_URL from '../config';
import { parseApiResponse } from '../utils/apiHelper';

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        const str = String(d).split('T')[0];
        return str;
    } catch {
        return String(d);
    }
};

const fmtDateTime = (d) => {
    if (!d) return '—';
    try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d).split('T')[0];
        return dt.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return String(d).split('T')[0];
    }
};

export default function CalendarRulesList({ onNavigate }) {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchDate, setSearchDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 8;

    const fetchRules = () => {
        setLoading(true);
        fetch(`${API_URL}/api/admin/calendar-rules`)
            .then(res => parseApiResponse(res, 'Failed to fetch calendar rules'))
            .then(data => {
                setRules(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch calendar rules:', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleDelete = (rule) => {
        Swal.fire({
            title: 'Delete Rule?',
            text: `Are you sure you want to delete the rule for ${rule.date}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API_URL}/api/admin/calendar-rules/delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: rule.id, date: rule.date })
                    });
                    const data = await parseApiResponse(res, 'Delete failed');

                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: `Rule for ${rule.date} has been removed.`,
                        confirmButtonColor: '#2C5F2D'
                    });
                    fetchRules();
                } catch (err) {
                    console.error('Error deleting calendar rule:', err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: err.message || 'Failed to delete rule.',
                        confirmButtonColor: '#2C5F2D'
                    });
                }
            }
        });
    };

    const todayStr = new Date().toISOString().split('T')[0];

    // Filter & sort
    const filteredRules = rules.filter(r => {
        if (filterStatus !== 'all' && (r.status || '').toLowerCase() !== filterStatus) {
            return false;
        }
        if (searchDate.trim() && !(r.date || '').includes(searchDate.trim())) {
            return false;
        }
        return true;
    });

    const sortedRules = [...filteredRules].sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalPages = Math.ceil(sortedRules.length / itemsPerPage);
    const currentRules = sortedRules.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0 }}>Calendar Rules</h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        ({rules.length} {rules.length === 1 ? 'rule' : 'rules'})
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={fetchRules}
                        className="admin-filter-btn"
                        title="Refresh calendar rules"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('calendar')}
                        className="admin-add-btn"
                        title="Open Calendar to configure rules"
                    >
                        <Plus size={16} /> Add Rule
                    </button>
                </div>
            </div>

            {/* Toolbar Filters */}
            <div className="admin-table-toolbar">
                <div className="admin-filter-group">
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Status:</span>
                    {['all', 'available', 'booked', 'blocked'].map(st => (
                        <button
                            key={st}
                            type="button"
                            className={`admin-filter-btn ${filterStatus === st ? 'active' : ''}`}
                            onClick={() => { setFilterStatus(st); setCurrentPage(1); }}
                        >
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Filter by date (YYYY-MM)..."
                        value={searchDate}
                        onChange={e => { setSearchDate(e.target.value); setCurrentPage(1); }}
                        style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            width: '210px'
                        }}
                    />
                    {searchDate && (
                        <button
                            type="button"
                            onClick={() => setSearchDate('')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.82rem'
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <p>Loading calendar rules...</p>
            ) : sortedRules.length === 0 ? (
                <div style={{ background: '#fff', padding: '30px', textAlign: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    <CalendarRange size={36} color="#94a3b8" style={{ marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No calendar rules found.</p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
                        Click "+ Add Rule" to open the calendar and set custom prices or block specific dates.
                    </p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.88rem' }}>
                        <thead style={{ background: '#1e293b', color: '#fff' }}>
                            <tr>
                                <th style={{ ...th, width: '60px', textAlign: 'center' }}>S.No</th>
                                <th style={th}>Date</th>
                                <th style={th}>Price</th>
                                <th style={th}>Status</th>
                                <th style={th}>Room Type</th>
                                <th style={th}>Reason</th>
                                <th style={th}>Last Updated</th>
                                <th style={{ ...th, textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRules.map((r, i) => (
                                <tr
                                    key={r.id || r.date || i}
                                    style={{ backgroundColor: r.date === todayStr ? '#f0f9f4' : 'transparent' }}
                                >
                                    <td style={{ ...td, textAlign: 'center', fontWeight: '500', color: '#64748b' }}>
                                        {(currentPage - 1) * itemsPerPage + i + 1}
                                    </td>
                                    <td style={{ ...td, fontWeight: '600', color: '#1e293b' }}>
                                        {fmtDate(r.date)}
                                        {r.date === todayStr && (
                                            <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#2C5F2D', fontWeight: '600' }}>
                                                (Today)
                                            </span>
                                        )}
                                    </td>
                                    <td style={td}>
                                        {r.price != null ? `₹${Number(r.price).toLocaleString()}` : <span style={{ color: '#94a3b8' }}>Default</span>}
                                    </td>
                                    <td style={td}>
                                        <span className={`status-badge ${(r.status || 'available').toLowerCase()}`}>
                                            {r.status || 'available'}
                                        </span>
                                    </td>
                                    <td style={{ ...td, textTransform: 'capitalize' }}>
                                        {r.room_type || 'full villa'}
                                    </td>
                                    <td style={{ ...td, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155' }} title={r.reason || ''}>
                                        {r.reason ? r.reason : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ ...td, color: '#64748b', fontSize: '0.82rem' }}>
                                        {fmtDateTime(r.updated_at || r.created_at)}
                                    </td>
                                    <td style={{ ...td, textAlign: 'center' }}>
                                        <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                                            <button
                                                type="button"
                                                className="action-icon-btn action-delete-btn"
                                                title="Delete Rule"
                                                aria-label="Delete Rule"
                                                onClick={() => handleDelete(r)}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination matching BookingList */}
                    <div style={{ marginTop: '15px', textAlign: 'center' }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="btn btn-secondary"
                        >
                            Prev
                        </button>
                        <span style={{ margin: '0 10px' }}>
                            Page {currentPage} of {totalPages || 1}
                        </span>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="btn btn-secondary"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const th = { padding: '10px 12px', border: '1px solid #2d3d55', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '9px 12px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
