import React, { createContext, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import BookingForm from './components/BookingForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Cancellation from './components/Cancellation';
import Review from './components/Review';
import AdminPanel from './pages/AdminPanel';

export const authContext = createContext();

function AppLayout() {
  const location = useLocation();
  // Check if current route is an admin page
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/adminpanel');

  return (
    <>
      {/* Show booking/user menu bar ONLY on user website side, NOT on admin dashboard */}
      {!isAdminRoute && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<div className="section container" style={{ marginTop: '130px' }}><BookingForm /></div>} />
        <Route path="/booking-confirm/:booking_id" element={<div className="section container" style={{ marginTop: '130px' }}><BookingForm /></div>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/adminpanel" element={<AdminPanel />} />
        <Route path="/admin/dashboard" element={<AdminPanel />} />
        <Route path='/cancellation' element={<div className="section container" style={{ marginTop: '130px' }}><Cancellation /></div>} />
        <Route path='/cancellation/:booking_id' element={<div className="section container" style={{ marginTop: '130px' }}><Cancellation /></div>} />
        <Route path='/review/:booking_id' element={<div className="section container" style={{ marginTop: '130px' }}><Review /></div>} />
      </Routes>
    </>
  );
}

function App() {

  const [token, setToken] = useState(() => {
    return localStorage.getItem('adminToken')
  });

  return (
    <authContext.Provider value={{ token, setToken }}>
      <Router>
        <AppLayout />
      </Router>
    </authContext.Provider>
  );
}

export default App;
