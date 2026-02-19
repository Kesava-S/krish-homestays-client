import React, { createContext, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import BookingForm from './components/BookingForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Cancellation from './components/Cancellation';
import Review from './components/Review';
import AdminPanel from './pages/AdminPanel';

export const authContext = createContext();

function App() {

  const [token, setToken] = useState(() => {
    return localStorage.getItem('adminToken')
  });

  return (
    <authContext.Provider value={{ token, setToken }}>
      <Router>
        {token ? '' : <Navbar />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<div className="section container" style={{ marginTop: '80px' }}><BookingForm /></div>} />
          <Route path="/booking-confirm/:booking_id" element={<div className="section container" style={{ marginTop: '80px' }}><BookingForm /></div>} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/adminpanel" element={<AdminPanel />} />
          <Route path="/admin/dashboard" element={<div className="section container" style={{ marginTop: '80px' }}><AdminDashboard /></div>} />
          <Route path='/cancellation' element={<div className="section container" style={{ marginTop: '80px' }}><Cancellation /></div>} />
          <Route path='/review/:booking_id' element={<div className="section container" style={{ marginTop: '80px' }}><Review /></div>} />
        </Routes>
      </Router>
    </authContext.Provider>
  );
}

export default App;
