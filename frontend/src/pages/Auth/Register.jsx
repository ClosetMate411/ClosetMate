import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../hooks';
import logo from '../../assets/Logo.png';
import { Toast } from '../../components';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const { toast, showError } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    
    setFieldErrors({}); // Reset errors

    const result = await register(formData);

    if (result.success) {
      const msg = result.message || 'Account created successfully!';
      navigate('/login', { 
        state: { message: msg, email: formData.email } 
      });
    } else {
      // Map multiple errors to fields if available
      if (result.errors && Array.isArray(result.errors)) {
        const mappedErrors = {};
        result.errors.forEach(err => {
          // err.field might be 'fullName', 'email', etc. 
          // We use the field name as the key.
          if (err.field) {
            mappedErrors[err.field] = err.message;
          }
        });
        setFieldErrors(mappedErrors);
        
        // If there's a general message or some fields didn't map, show a general Toast
        if (!Object.keys(mappedErrors).length) {
            showError(result.error || 'Registration failed');
        }
      } else {
        // Fallback to Toast if no structured field errors are provided
        showError(result.error || 'Registration failed');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src={logo} alt="ClosetMate Logo" className="auth-logo-img" />
          </div>
          <h1 className="auth-title">Register</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              className={`form-input ${fieldErrors.fullName ? 'invalid' : ''}`}
              type="text"
              id="fullName"
              name="fullName"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={handleChange}
              disabled={isLoading}
            />
            {fieldErrors.fullName && <span className="error-message">{fieldErrors.fullName}</span>}
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              className={`form-input ${fieldErrors.email ? 'invalid' : ''}`}
              type="email"
              id="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            {fieldErrors.email && <span className="error-message">{fieldErrors.email}</span>}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              className={`form-input ${fieldErrors.password ? 'invalid' : ''}`}
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
            {fieldErrors.password && <span className="error-message">{fieldErrors.password}</span>}
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              className={`form-input ${fieldErrors.confirmPassword ? 'invalid' : ''}`}
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
            {fieldErrors.confirmPassword && <span className="error-message">{fieldErrors.confirmPassword}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login" className="auth-link">Already have an account? Login</Link>
        </div>
      </div>
      
      {/* Toast Notification for general errors */}
      <Toast {...toast} />
    </div>
  );
};

export default Register;
