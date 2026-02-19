import React, { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import BookingList from './BookingList';

export default function AdminPanel() {

  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8' }}>
      
      {/* Sidebar */}
      <div style={{
        width: '220px',
        background: '#1e293b',
        color: '#fff',
        padding: '20px'
      }}>
        <h3 style={{ color: '#fff' }}>Krish Admin</h3>

        <div
          style={{ marginTop: '20px', cursor: 'pointer', color: activePage === 'dashboard' ? '#38bdf8' : '#fff' }}
          onClick={() => setActivePage('dashboard')}
        >
          Dashboard
        </div>

        <div
          style={{ marginTop: '10px', cursor: 'pointer', color: activePage === 'bookings' ? '#38bdf8' : '#fff' }}
          onClick={() => setActivePage('bookings')}
        >
          Bookings
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '30px' }}>
        {activePage === 'dashboard' && <AdminDashboard />}
        {activePage === 'bookings' && <BookingList />}
      </div>

    </div>
  );
}
