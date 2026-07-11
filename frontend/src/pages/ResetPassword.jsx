import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/API';
import '../styles/ForgotPassword.css';

function ResetPassword() {
  const { token } = useParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const { password, confirmPassword } = formData;

    if (!password || !confirmPassword) {
      setError('Both password fields are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await authAPI.resetPassword(token, password);
      setSuccess('Your password has been updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err || 'Failed to update your password. Token might be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-page-wrapper">
      <div className="glass-container forgot-card">
        <div className="card-header">
          <h2>Create New Password</h2>
          <p>Choose a secure, strong password for your account.</p>
        </div>

        {error && <div className="alert-toast error">{error}</div>}
        {success && <div className="alert-toast success">{success}</div>}

        {!success && (
          <form onSubmit={handleFormSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="Choose new password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="Re-enter new password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? 'Updating Password...' : 'Save Password'}
            </button>
          </form>
        )}

        <div className="card-footer">
          <p>Cancel and <Link to="/login" className="login-link">Back to Login</Link></p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
