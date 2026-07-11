import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/API';
import '../styles/ForgotPassword.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devResetLink, setDevResetLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const navigate = useNavigate();

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    setDevResetLink('');

    try {
      const response = await authAPI.forgotPassword(email.toLowerCase().trim());
      setSuccessMessage(response.message || 'Instructions link has been dispatched.');
      
      // In development mode, backends expose resetLink for direct local navigation
      if (response.resetLink) {
        setDevResetLink(response.resetLink);
      }
    } catch (err) {
      setError(err || 'Failed to dispatch reset instructions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyDevLink = () => {
    if (!devResetLink) return;
    navigator.clipboard.writeText(devResetLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="forgot-page-wrapper">
      <div className="glass-container forgot-card">
        <div className="card-header">
          <h2>Reset Password</h2>
          <p>Enter your registered email address and we'll dispatch an instructions link to reset your password.</p>
        </div>

        {error && <div className="alert-toast error">{error}</div>}
        {successMessage && <div className="alert-toast success">{successMessage}</div>}

        {!successMessage ? (
          <form onSubmit={handleFormSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="Enter email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? 'Dispatching Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="success-action-area">
            {devResetLink && (
              <div className="dev-reset-sandbox">
                <span className="sandbox-title">🛠️ Local Development Sandbox Link</span>
                <p>Since this is a development instance, the reset link has been captured. Click below to copy it or open it directly:</p>
                <div className="sandbox-actions">
                  <button type="button" className="btn-sandbox-copy" onClick={handleCopyDevLink}>
                    {copiedLink ? 'Link Copied!' : 'Copy Reset URL'}
                  </button>
                  <a href={devResetLink} className="btn-sandbox-open">Open Reset Page</a>
                </div>
              </div>
            )}
            <button className="btn-submit" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        )}

        <div className="card-footer">
          <p>Remembered your password? <Link to="/login" className="login-link">Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;