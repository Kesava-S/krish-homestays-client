import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import { authContext } from '../App';

const AdminLogin = () => {

    const {token, setToken} = useContext(authContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                setToken(data.token);
                navigate('/adminpanel');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Server error');
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-light)'
        }}>
            <div className="glass-card" style={{ padding: '40px', width: '100%', maxWidth: '400px' }}>
                <h2 className="text-center mb-4" style={{ color: 'var(--primary)' }}>Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
