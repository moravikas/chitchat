import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/API';
import '../styles/Signup.css';

function Signup() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear errors as user types
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
    const { firstName, lastName, email, mobileNumber, password, confirmPassword } = formData;

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!/^[A-Za-z\s]+$/.test(firstName.trim())) {
      newErrors.firstName = 'First name can only contain letters';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!/^[A-Za-z\s]+$/.test(lastName.trim())) {
      newErrors.lastName = 'Last name can only contain letters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else {
      const isNumeric = /^\d+$/.test(mobileNumber.trim());
      if (!isNumeric) {
        newErrors.mobileNumber = 'Mobile number must contain digits only';
      } else if (mobileNumber.trim().length < 8 || mobileNumber.trim().length > 15) {
        newErrors.mobileNumber = 'Mobile number must be between 8 and 15 digits';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        password: formData.password
      };
      
      const response = await authAPI.signup(payload);
      setServerSuccess(response.message || 'Registration successful! Redirecting to login...');
      
      // Reset form on success
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        mobileNumber: '',
        password: '',
        confirmPassword: ''
      });

      // Redirect user to login page after a delay
      setTimeout(() => {
        setIsLoading(false);
        navigate('/login');
      }, 2000);

    } catch (err) {
      setIsLoading(false);
      setServerError(err);
    }
  };

  return (
    <div className="signup-page-wrapper">
      <div className="signup-card-container glass-container">
        <div className="signup-header">
          <h2>Create Account</h2>
          <p>Get started by setting up your profile details</p>
        </div>

        {serverError && <div className="alert-toast error">{serverError}</div>}
        {serverSuccess && <div className="alert-toast success">{serverSuccess}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={`form-input ${errors.firstName ? 'error' : ''}`}
                placeholder="John"
                disabled={isLoading}
              />
              {errors.firstName && <div className="error-message">{errors.firstName}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={`form-input ${errors.lastName ? 'error' : ''}`}
                placeholder="Doe"
                disabled={isLoading}
              />
              {errors.lastName && <div className="error-message">{errors.lastName}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="john.doe@example.com"
                disabled={isLoading}
              />
              {errors.email && <div className="error-message">{errors.email}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mobileNumber">Mobile Number</label>
              <input
                type="tel"
                id="mobileNumber"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleInputChange}
                className={`form-input ${errors.mobileNumber ? 'error' : ''}`}
                placeholder="9876543210"
                disabled={isLoading}
              />
              {errors.mobileNumber && <div className="error-message">{errors.mobileNumber}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="••••••"
                disabled={isLoading}
              />
              {errors.password && <div className="error-message">{errors.password}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="••••••"
                disabled={isLoading}
              />
              {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? (
              <span className="btn-spinner-wrapper">
                <span className="spinner"></span>
                Creating account...
              </span>
            ) : 'Sign Up'}
          </button>
        </form>

        <div className="signup-footer">
          <p>Already have an account? <Link to="/login" className="login-link">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Signup;