import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import './Navbar.css'; // I'll create this for specific styles

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="navbar glass-card">
            <div className="nav-container">
                <Link to="/" className="logo">
                    <img src="/assets/logo/logo.png" alt="Krish Homestay Logo" className="logo-img" />
                    Krish Homestay
                </Link>

                <div className={`nav-links ${isOpen ? 'active' : ''}`}>
                    <Link to="/" onClick={() => setIsOpen(false)}>Home</Link>
                    <a href="#about" onClick={() => setIsOpen(false)}>About</a>
                    <a href="#rooms" onClick={() => setIsOpen(false)}>Rooms</a>
                    <a href="#amenities" onClick={() => setIsOpen(false)}>Amenities</a>
                    <a href="#attractions" onClick={() => setIsOpen(false)}>Attractions</a>
                    <a href="#policies" onClick={() => setIsOpen(false)}>Policies</a>
                    <a href="#gallery" onClick={() => setIsOpen(false)}>Gallery</a>
                    <Link to="/book" className="btn btn-primary book-btn" onClick={() => setIsOpen(false)}>Book Now</Link>
                </div>

                <div className="mobile-toggle" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <X color="var(--primary)" /> : <Menu color="var(--primary)" />}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
