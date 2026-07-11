import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/API';
import '../styles/Login.css';

function Login() {
  const [formData, setFormData] = useState({
    emailOrMobile: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const navigate = useNavigate();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('test@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText('123456');
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear errors when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
    setServerError('');
  };

  const validateForm = () => {
    const newErrors = {};
    const { emailOrMobile, password } = formData;

    if (!emailOrMobile.trim()) {
      newErrors.emailOrMobile = 'Email or Mobile number is required';
    } else {
      const term = emailOrMobile.trim();
      if (term.includes('@')) {
        // Email pattern
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(term)) {
          newErrors.emailOrMobile = 'Please enter a valid email address';
        }
      } else {
        // Mobile number pattern (digits only, e.g. 10 digits)
        const isNumeric = /^\d+$/.test(term);
        if (isNumeric) {
          if (term.length < 8 || term.length > 15) {
            newErrors.emailOrMobile = 'Mobile number must be between 8 and 15 digits';
          }
        } else {
          newErrors.emailOrMobile = 'Enter a valid email or numeric mobile number';
        }
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setServerError('');
    setServerSuccess('');

    try {
      const response = await authAPI.login(formData.emailOrMobile, formData.password);
      setServerSuccess('Login successful! Redirecting...');
      
      // Store token & user details in local storage
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      // Simulate a small delay for a premium redirection transition
      setTimeout(() => {
        setIsLoading(false);
        navigate('/chat');
      }, 1000);

    } catch (err) {
      setIsLoading(false);
      setServerError(err);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-split-layout">
        {/* Left Art/Branding Panel (visible on desktop) */}
        <div className="login-art-panel">
          <div className="art-content">
            <div className="app-logo-mark">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>ChitChat</span>
            </div>
            <h1>Connect instantly with friends.</h1>
            <p>Experience the next generation of messaging. Real-time updates, elegant glassmorphic interface, and secure end-to-end communication.</p>
            <div className="test-credentials-card">
              <span className="test-card-title">🚀 Test / Demo Account</span>
              <div className="test-credential-row">
                <span className="test-label">Email:</span>
                <div className="test-code-copy-wrapper">
                  <code className="test-code">test@gmail.com</code>
                  <button
                    type="button"
                    className="copy-badge-btn"
                    onClick={handleCopyEmail}
                    title="Copy Email"
                  >
                    {copiedEmail ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="test-credential-row">
                <span className="test-label">Password:</span>
                <div className="test-code-copy-wrapper">
                  <code className="test-code">123456</code>
                  <button
                    type="button"
                    className="copy-badge-btn"
                    onClick={handleCopyPassword}
                    title="Copy Password"
                  >
                    {copiedPassword ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              <div className="test-card-actions">
                <button
                  type="button"
                  className="btn-quick-fill"
                  onClick={() => {
                    setFormData({
                      emailOrMobile: 'test@gmail.com',
                      password: '123456'
                    });
                    setErrors({});
                  }}
                  title="Click to auto-fill the login form"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Auto-Fill Test Credentials
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="login-form-panel">
          <div className="glass-container login-card">
            <div className="card-header">
              <h2>Welcome Back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            {serverError && <div className="alert-toast error">{serverError}</div>}
            {serverSuccess && <div className="alert-toast success">{serverSuccess}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="emailOrMobile">Email or Mobile Number</label>
                <div className="input-container">
                  <input
                    type="text"
                    id="emailOrMobile"
                    name="emailOrMobile"
                    value={formData.emailOrMobile}
                    onChange={handleInputChange}
                    className={`form-input ${errors.emailOrMobile ? 'error' : ''}`}
                    placeholder="Enter email or mobile"
                    disabled={isLoading}
                  />
                </div>
                {errors.emailOrMobile && <div className="error-message">{errors.emailOrMobile}</div>}
              </div>

              <div className="form-group">
                <div className="label-wrapper">
                  <label className="form-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                </div>
                <div className="input-container">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>

              <button type="submit" className="btn-submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="btn-spinner-wrapper">
                    <span className="spinner"></span>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="card-footer">
              <p>Don't have an account? <Link to="/signup" className="signup-link">Create Account</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;