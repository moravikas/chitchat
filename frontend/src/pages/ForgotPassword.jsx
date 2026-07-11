import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/API';
import '../styles/ForgotPassword.css';

function ForgotPassword() {
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setEmailOrMobile(e.target.value);
    setError('');
    setServerError('');
  };

  const validateForm = () => {
    const term = emailOrMobile.trim();
    if (!term) {
      setError('Email or Mobile number is required');
      return false;
    }

    if (term.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(term)) {
        setError('Please enter a valid email address');
        return false;
      }
    } else {
      const isNumeric = /^\d+$/.test(term);
      if (isNumeric) {
        if (term.length < 8 || term.length > 15) {
          setError('Mobile number must be between 8 and 15 digits');
          return false;
        }
      } else {
        setError('Enter a valid email or numeric mobile number');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setServerError('');
    setServerSuccess('');

    try {
      const response = await authAPI.forgotPassword(emailOrMobile);
      setServerSuccess(response.message || 'Password reset link sent successfully!');
      setEmailOrMobile('');
    } catch (err) {
      setServerError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-page-wrapper">
      <div className="forgot-card glass-container">
        <div className="forgot-header">
          <div className="lock-icon-wrapper">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Forgot Password?</h2>
          <p>Enter your registered email or mobile number and we'll send you instructions to reset your password.</p>
        </div>

        {serverError && <div className="alert-toast error">{serverError}</div>}
        {serverSuccess && <div className="alert-toast success">{serverSuccess}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="emailOrMobile">Email or Mobile Number</label>
            <input
              type="text"
              id="emailOrMobile"
              value={emailOrMobile}
              onChange={handleInputChange}
              className={`form-input ${error ? 'error' : ''}`}
              placeholder="Enter email or mobile"
              disabled={isLoading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? (
              <span className="btn-spinner-wrapper">
                <span className="spinner"></span>
                Sending...
              </span>
            ) : 'Send Reset Instructions'}
          </button>
        </form>

        <div className="forgot-footer">
          <Link to="/login" className="back-to-login">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;