import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const handleSectionClick = (e, sectionId) => {
        e.preventDefault();
        setIsOpen(false);

        if (location.pathname === '/') {
            // Already on Home page, smoothly scroll to the section
            const el = document.getElementById(sectionId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            // On another page (e.g. /book) - navigate to home page and scroll to section
            navigate(`/#${sectionId}`);
            setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                }
            }, 150);
        }
    };

    const handleHomeClick = (e) => {
        setIsOpen(false);
        if (location.pathname === '/') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <nav className="navbar glass-card">
            <div className="nav-container">
                <Link to="/" className="logo" onClick={handleHomeClick}>
                    <img src="/assets/logo/logo.png" alt="Krish Homestays Logo" className="logo-img" />
                    Krish Homestays
                </Link>

                <div className={`nav-links ${isOpen ? 'active' : ''}`}>
                    <Link to="/" onClick={handleHomeClick}>Home</Link>
                    <a href="/#about" onClick={(e) => handleSectionClick(e, 'about')}>About</a>
                    <a href="/#amenities" onClick={(e) => handleSectionClick(e, 'amenities')}>Amenities</a>
                    <a href="/#attractions" onClick={(e) => handleSectionClick(e, 'attractions')}>Attractions</a>
                    <a href="/#policies" onClick={(e) => handleSectionClick(e, 'policies')}>Policies</a>
                    <a href="/#gallery" onClick={(e) => handleSectionClick(e, 'gallery')}>Gallery</a>
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
