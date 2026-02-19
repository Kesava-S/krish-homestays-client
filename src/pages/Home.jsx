import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Wifi, Coffee, Shield, Wind, Camera, Instagram } from 'lucide-react';
import BookingForm from '../components/BookingForm';

const VideoPlayer = ({ src }) => {
    const videoRef = React.useRef(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
                } else {
                    videoRef.current.pause();
                }
            },
            { threshold: 0.5 } // Play when 50% visible
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            if (videoRef.current) {
                observer.unobserve(videoRef.current);
            }
        };
    }, []);

    return (
        <video
            ref={videoRef}
            controls
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        >
            <source src={src} type="video/mp4" />
            Your browser does not support the video tag.
        </video>
    );
};

const Home = () => {
    return (
        <div className="home">
            {/* Hero Section */}
            <section className="hero" style={{
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(/assets/hero.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                textAlign: 'center',
                padding: '0 20px',
                position: 'relative'
            }}>
                <div className="hero-content" style={{ zIndex: 2 }}>
                    <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)', marginBottom: '20px', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>Krish Homestay</h1>
                    <p style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', marginBottom: '30px', maxWidth: '800px', margin: '0 auto 30px', textShadow: '0 1px 5px rgba(0,0,0,0.3)' }}>
                        Stay in a traditional Kerala home where tranquility and cleanliness come first.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                        <Link to="/book" className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '15px 40px' }}>Book Your Stay</Link>
                        <a href="https://wa.me/918807200931" target="_blank" rel="noreferrer" className="btn btn-primary" style={{
                            fontSize: '1.2rem',
                            padding: '15px 40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#25D366'
                        }}>
                            <Phone size={20} /> Chat on WhatsApp
                        </a>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="section container">
                <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'center' }}>
                    <div>
                        <h1>About Our Homestay</h1>
                        <p className="mt-4">
                            Stay in a traditional Kerala home where tranquility and cleanliness come first. With soothing mountain views and a naturally calm atmosphere, it’s the perfect retreat for travellers seeking an immersive, genuine Munnar experience.
                        </p>
                        <p className="mt-4">
                            We value silence and nature, offering a peaceful environment for families, couples, and remote workers.
                        </p>
                        <div className="mt-4" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <MapPin color="var(--primary)" /> Munnar, Kerala
                            </div>
                            <a href="https://maps.app.goo.gl/3GWQnNLLQniAej9t8" target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                                View on Google Maps
                            </a>
                        </div>
                    </div>
                    <div>
                        <img src="/assets/about_image.jpg" alt="About Krish Homestay" style={{ width: '100%', borderRadius: '20px', boxShadow: 'var(--shadow)' }} />
                    </div>
                </div>
            </section>

            {/* Amenities */}
            <section id="amenities" className="section" style={{ background: 'white' }}>
                <div className="container">
                    <h1 className="text-center mb-4">Amenities</h1>
                    <div className="grid-3">
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Shield color="var(--primary)" /> Essential & Comfort</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Spotlessly clean rooms & bathrooms</li>
                                <li>✓ 24/7 hot water</li>
                                <li>✓ High-speed WiFi</li>
                                <li>✓ Comfortable beds with fresh linens</li>
                                <li>✓ Daily housekeeping</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Wind color="var(--primary)" /> Nature & Views</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Balcony with tea garden / valley views</li>
                                <li>✓ Quiet, peaceful surroundings</li>
                                <li>✓ Private sit-out area</li>
                                <li>✓ Silent stay policy</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Coffee color="var(--primary)" /> Kerala Culture</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Traditional Kerala breakfast</li>
                                <li>✓ Authentic home-cooked meals (on request)</li>
                                <li>✓ Local tea tasting guidance</li>
                                <li>✓ Plantation walk guidance</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Shield color="var(--primary)" /> Convenience & Safety</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Free parking</li>
                                <li>✓ CCTV-secured property</li>
                                <li>✓ Power backup / inverter</li>
                                <li>✓ On-call travel support</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Camera color="var(--primary)" /> Outdoor & Experiences</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Garden space</li>
                                <li>✓ Bonfire (on request)</li>
                                <li>✓ Guided trekking arrangements</li>
                                <li>✓ Pickup/drop assistance</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Wifi color="var(--primary)" /> Room Amenities</h3>
                            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li>✓ Tea/coffee kettle</li>
                                <li>✓ Basic toiletries</li>
                                <li>✓ Wardrobe / luggage space</li>
                                <li>✓ No-mosquito environment</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Nearby Attractions */}
            <section id="attractions" className="section container">
                <h1 className="text-center mb-5">Nearby Attractions</h1><br/>
                <div className="grid-3">
                    <div className="glass-card">
                        <img src="/assets/gallery/Pothamedu Viewpoint.jpg" alt="Pothamedu Viewpoint" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                        <h3>Pothamedu Viewpoint</h3>
                        <p className="mt-2">Offers sweeping views of tea, coffee and cardamom plantations. Very photogenic around sunrise/sunset.</p>
                    </div>
                    <div className="glass-card">
                        <img src="/assets/gallery/Echo Point Munnar.jpg" alt="Echo Point" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                        <h3>Echo Point Munnar</h3>
                        <p className="mt-2">Known for the natural echo phenomenon amid the hills and lake-side atmosphere. Great for a fun outing.</p>
                    </div>
                    <div className="glass-card">
                        <img src="/assets/view.png" alt="Attukad Waterfalls" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                        <h3>Attukad Waterfalls</h3>
                        <p className="mt-2">A scenic waterfall nestled within tea plantations. Perfect for nature lovers and a short trek.</p>
                    </div>
                    <div className="glass-card">
                        <img src="/assets/about_image.jpg" alt="Tea Museum" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                        <h3>Tea Museum</h3>
                        <p className="mt-2">A cultural-educational experience showing the history of the region’s tea industry.</p>
                    </div>
                    <div className="glass-card">
                        <img src="/assets/gallery/Sengulam Dam.jpg" alt="Sengulam Dam" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
                        <h3>Sengulam Dam</h3>
                        <p className="mt-2">A lesser-known, quiet spot for boating and relaxation. Ideal for escaping the crowds.</p>
                    </div>
                </div>
            </section>

            {/* Policies */}
            <section id="policies" className="section" style={{ background: 'var(--bg-light)' }}>
                <div className="container">
                    <h1 className="text-center mb-5">Homestay Policies</h1><br/>
                    <div className="grid-3">
                        <div className="glass-card">
                            <h3>Check-in & Check-out</h3>
                            <ul className="mt-3" style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li><strong>Check-in:</strong> 2:00 PM – 3:00 PM</li>
                                <li><strong>Check-out:</strong> 10:00 AM – 11:00 AM</li>
                                <li style={{ fontSize: '0.9rem', marginTop: '10px' }}>Early/Late options subject to availability.</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3>Cancellation Policy</h3>
                            <ul className="mt-3" style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li><strong>Free cancellation:</strong> Up to 3–5 days before check-in.</li>
                                <li><strong>50–75% charged:</strong> Within 3–5 days.</li>
                                <li><strong>No-show:</strong> Full amount charged.</li>
                            </ul>
                        </div>
                        <div className="glass-card">
                            <h3>House Rules</h3>
                            <ul className="mt-3" style={{ listStyle: 'none', paddingLeft: 0 }}>
                                <li><strong>Quiet Hours:</strong> After 9:00 PM.</li>
                                <li><strong>Hygiene:</strong> Remove shoes indoors.</li>
                                <li><strong>Smoking:</strong> Outdoor areas only.</li>
                                <li><strong>Alcohol:</strong> Private spaces only.</li>
                                <li><strong>Visitors:</strong> Not allowed.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Gallery Section */}
            <section id="gallery" className="section" style={{ background: 'white' }}>
                <div className="container">
                    <h1 className="text-center">Gallery</h1>
                    <p className="text-center mb-5">Explore our beautiful property and surroundings.</p><br/>

                    <div className="gallery-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px'
                    }}>
                        {/* Images */}
                        <img src="/assets/gallery/gallery_1.jpg" alt="Living Area" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px', transition: 'transform 0.3s' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_2.jpg" alt="Balcony View" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_3.jpg" alt="Balcony Seating" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_4.jpg" alt="Parking & Entrance" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_5.jpg" alt="Outdoor Dining" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_6.jpg" alt="Outdoor area" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_7.jpg" alt="Outdoor veranda" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_8.jpg" alt="Living room" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_9.jpg" alt="Air comditioning room" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_10.jpg" alt="clean restroom" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_11.png" alt="home outside view" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />
                        <img src="/assets/gallery/gallery_12.png" alt="outside view" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '10px' }} className="gallery-item" />

                        {/* Video 1 */}
                        <div style={{ position: 'relative', height: '300px', borderRadius: '10px', overflow: 'hidden', background: '#000' }}>
                            <VideoPlayer src="/assets/video1.mp4" />
                        </div>
                    </div>
                </div>

            </section>

            {/* Booking Section */}
            <section id="book" className="section" style={{ background: 'var(--bg-light)' }}>
                <div className="container">
                    <BookingForm />
                </div>
            </section>

            {/* Footer */}
            <footer style={{ background: 'var(--bg-dark)', color: 'white', padding: '50px 0' }}>
                <div className="container grid-3">
                    <div>
                        <h3 style={{ color: 'white' }}>Krish Homestay</h3>
                        <p className="mt-4">Your home away from home in Munnar.</p>
                    </div>
                    <div>
                        <h3 style={{ color: 'white' }}>Contact Us</h3>
                        <p className="mt-4">Phone: +91 73053 95094</p>
                        <p>Email: krishhomestays@gmail.com</p>
                        <a href="https://wa.me/917305395094" target="_blank" rel="noreferrer" className="btn btn-primary mt-4" style={{ backgroundColor: '#25D366', border: 'none' }}>
                            Chat on WhatsApp
                        </a>
                        <a href="https://www.instagram.com/krish_homestay_munnar?igsh=Y200NDRvbHE1MmZv" target="_blank" rel="noreferrer" className="btn mt-4" style={{ background: '#E1306C', color: 'white', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginLeft: '0' }}>
                            <Instagram size={20} /> Follow on Instagram
                        </a>
                    </div>
                    <div>
                        <h3 style={{ color: 'white' }}>Location</h3>
                        <p className="mt-4">Munnar, Kerala, India</p>
                        <a href="https://maps.app.goo.gl/3GWQnNLLQniAej9t8" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--primary-light)' }}>
                            Get Directions
                        </a>
                    </div>
                </div>
                <div className="text-center mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                    <p>&copy; 2025 Krish Homestay. All rights reserved.</p>
                    <Link to="/admin" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', textDecoration: 'none', marginLeft: '10px' }}>Admin</Link>
                </div>
            </footer>
        </div >
    );
};

export default Home;
