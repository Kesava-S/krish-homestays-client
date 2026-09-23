import React, { useState, useContext } from 'react';
import AdminDashboard from './AdminDashboard';
import BookingList from './BookingList';
import InvoiceGenerator from './InvoiceGenerator';
import { authContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import './AdminPanel.css'; 

export default function AdminPanel() {

  const { token, setToken } = useContext(authContext);
  const [activePage, setActivePage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  if (!token) {
    navigate("/admin")
  }

  const handleNavClick = (page) => {
      setActivePage(page);
      setIsMobileMenuOpen(false); // Close menu on click in mobile
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-header">
            <h3>Krish Admin</h3>
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} color="#fff" /> : <Menu size={24} color="#fff" />}
            </button>
        </div>

        <div className={`sidebar-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <div
              className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              Dashboard
            </div>

            <div
              className={`sidebar-item ${activePage === 'bookings' ? 'active' : ''}`}
              onClick={() => handleNavClick('bookings')}
            >
              Bookings
            </div>

            <div
              className={`sidebar-item ${activePage === 'invoice' ? 'active' : ''}`}
              onClick={() => handleNavClick('invoice')}
            >
              Invoice
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="admin-content">
        {activePage === 'dashboard' && <AdminDashboard />}
        {activePage === 'bookings' && <BookingList />}
        {activePage === 'invoice' && <InvoiceGenerator />}
      </div>

    </div>
  );
}
