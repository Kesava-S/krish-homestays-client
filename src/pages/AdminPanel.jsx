import React, { useState, useContext, useEffect } from 'react';
import OverviewDashboard from './OverviewDashboard';
import AdminDashboard from './AdminDashboard';
import BookingList from './BookingList';
import CalendarRulesList from './CalendarRulesList';
import InvoiceGenerator from './InvoiceGenerator';
import { authContext } from '../App';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Calendar, Users, CalendarRange, FileText, Globe, LogOut } from 'lucide-react';
import './AdminPanel.css'; 

export default function AdminPanel() {

  const { token, setToken } = useContext(authContext);
  const [activePage, setActivePage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = token || localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate("/admin");
    }
  }, [token, navigate]);

  const handleNavClick = (page) => {
      setActivePage(page);
      setIsMobileMenuOpen(false); // Close menu on click in mobile
  };

  const handleLogout = () => {
      localStorage.removeItem('adminToken');
      setToken(null);
      navigate('/admin');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/assets/logo/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <h3 style={{ margin: 0, color: '#fff' }}>Krish Admin</h3>
            </div>
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} color="#fff" /> : <Menu size={24} color="#fff" />}
            </button>
        </div>

        <div className={`sidebar-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <div
              className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </div>

            <div
              className={`sidebar-item ${activePage === 'calendar' ? 'active' : ''}`}
              onClick={() => handleNavClick('calendar')}
            >
              <Calendar size={18} />
              <span>Calendar</span>
            </div>

            <div
              className={`sidebar-item ${activePage === 'bookings' ? 'active' : ''}`}
              onClick={() => handleNavClick('bookings')}
            >
              <Users size={18} />
              <span>Bookings</span>
            </div>

            <div
              className={`sidebar-item ${activePage === 'calendar-rules' ? 'active' : ''}`}
              onClick={() => handleNavClick('calendar-rules')}
            >
              <CalendarRange size={18} />
              <span>Calendar Rules</span>
            </div>

            <div
              className={`sidebar-item ${activePage === 'invoice' ? 'active' : ''}`}
              onClick={() => handleNavClick('invoice')}
            >
              <FileText size={18} />
              <span>Invoice</span>
            </div>

            <div style={{ margin: '20px 0 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>

            <Link to="/" className="sidebar-item" style={{ textDecoration: 'none', color: '#fff' }}>
              <Globe size={18} />
              <span>View Website</span>
            </Link>

            <div className="sidebar-item" onClick={handleLogout} style={{ color: '#f87171' }}>
              <LogOut size={18} />
              <span>Logout</span>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="admin-content">
        {activePage === 'dashboard' && <OverviewDashboard onNavigate={handleNavClick} isActive={activePage === 'dashboard'} />}
        {activePage === 'calendar' && <AdminDashboard />}
        {activePage === 'bookings' && <BookingList />}
        {activePage === 'calendar-rules' && <CalendarRulesList onNavigate={handleNavClick} />}
        {activePage === 'invoice' && <InvoiceGenerator />}
      </div>

    </div>
  );
}
