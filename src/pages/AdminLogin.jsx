import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, LogIn } from 'lucide-react';
import API_URL from '../config';
import { authContext } from '../App';
import './AdminLogin.css';

const AdminLogin = () => {
    const { token, setToken } = useContext(authContext);
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({ username: '', password: '' });
    const [serverError, setServerError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const usernameInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    useEffect(() => {
        if (token) {
            navigate("/adminpanel");
        }
    }, [token, navigate]);

    // Validate a specific field or all fields
    const validateField = (field, value) => {
        if (field === 'username') {
            if (!value || !value.trim()) {
                return 'Please enter your username';
            }
            return '';
        }
        if (field === 'password') {
            if (!value) {
                return 'Please enter your password';
            }
            return '';
        }
        return '';
    };

    const handleUsernameChange = (e) => {
        const val = e.target.value;
        setUsername(val);
        if (errors.username) {
            setErrors(prev => ({ ...prev, username: '' }));
        }
        if (serverError) setServerError('');
    };

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setPassword(val);
        if (errors.password) {
            setErrors(prev => ({ ...prev, password: '' }));
        }
        if (serverError) setServerError('');
    };

    const handleBlur = (field) => {
        const value = field === 'username' ? username : password;
        const errorMsg = validateField(field, value);
        if (errorMsg) {
            setErrors(prev => ({ ...prev, [field]: errorMsg }));
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setServerError('');

        const usernameError = validateField('username', username);
        const passwordError = validateField('password', password);

        if (usernameError || passwordError) {
            setErrors({
                username: usernameError,
                password: passwordError
            });
            if (usernameError && usernameInputRef.current) {
                usernameInputRef.current.focus();
            } else if (passwordError && passwordInputRef.current) {
                passwordInputRef.current.focus();
            }
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password })
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                setToken(data.token);
                navigate('/adminpanel');
            } else {
                setServerError(data.error || 'Invalid username or password');
            }
        } catch (err) {
            setServerError('Unable to connect to the server. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="admin-login-wrapper">
            <div className="admin-login-card">
                {/* Brand Header with Logo & Name */}
                <div className="admin-login-header">
                    <div className="admin-login-logo-wrap">
                        <img 
                            src="/assets/logo/logo.png" 
                            alt="Krish Homestays Logo" 
                            className="admin-login-logo" 
                        />
                    </div>
                    <h1 className="admin-login-brand-title">Krish Homestays Admin</h1>
                </div>

                {/* Server Error Banner */}
                {serverError && (
                    <div className="admin-login-alert-banner" role="alert">
                        <AlertCircle size={18} />
                        <span>{serverError}</span>
                    </div>
                )}

                {/* Login Form with Custom Validation */}
                <form onSubmit={handleLogin} noValidate className="admin-login-form">
                    {/* Username Field */}
                    <div className="admin-form-group">
                        <label className="admin-form-label" htmlFor="admin-username">
                            <span>Username</span>
                        </label>
                        <div className="admin-input-wrapper">
                            <User 
                                size={18} 
                                className={`admin-input-icon ${errors.username ? 'icon-has-error' : ''}`} 
                            />
                            <input
                                id="admin-username"
                                ref={usernameInputRef}
                                type="text"
                                className={`admin-input-field ${errors.username ? 'input-has-error' : ''}`}
                                placeholder="Enter admin username"
                                value={username}
                                onChange={handleUsernameChange}
                                onBlur={() => handleBlur('username')}
                                disabled={isSubmitting}
                                autoComplete="username"
                            />
                        </div>
                        {errors.username && (
                            <span className="admin-field-error">
                                <AlertCircle size={13} />
                                {errors.username}
                            </span>
                        )}
                    </div>

                    {/* Password Field */}
                    <div className="admin-form-group">
                        <label className="admin-form-label" htmlFor="admin-password">
                            <span>Password</span>
                        </label>
                        <div className="admin-input-wrapper">
                            <Lock 
                                size={18} 
                                className={`admin-input-icon ${errors.password ? 'icon-has-error' : ''}`} 
                            />
                            <input
                                id="admin-password"
                                ref={passwordInputRef}
                                type={showPassword ? 'text' : 'password'}
                                className={`admin-input-field ${errors.password ? 'input-has-error' : ''}`}
                                placeholder="Enter password"
                                value={password}
                                onChange={handlePasswordChange}
                                onBlur={() => handleBlur('password')}
                                disabled={isSubmitting}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="admin-password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {errors.password && (
                            <span className="admin-field-error">
                                <AlertCircle size={13} />
                                {errors.password}
                            </span>
                        )}
                    </div>

                    {/* Submit Button with Preloader Spinner */}
                    <button 
                        type="submit" 
                        className="admin-login-submit-btn"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="admin-btn-spinner" />
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                <span>Login</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
