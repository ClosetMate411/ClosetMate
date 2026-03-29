import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiService from '../../services/api.service';
import { useToast } from '../../hooks';
import logo from '../../assets/ClosetMate_Logo.svg';
import { Toast } from '../../components';
import './Auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast, showError } = useToast();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (formData.password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await apiService.resetPassword({
        token,
        newPassword: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      navigate('/login', {
        state: { message: 'Password updated successfully, please log in.' },
      });
    } catch (err) {
      const msg = err.message || 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('expir')) {
        showError('This link has expired. Please request a new one.');
      } else {
        showError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Missing / invalid token ────────────────────────────
  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Invalid Link</h1>
            <p className="auth-subtitle">
              This reset link is invalid or missing. Please request a new one.
            </p>
          </div>
          <div className="auth-footer">
            <Link to="/forgot-password" className="auth-link">Request a new reset link</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset form ─────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src={logo} alt="ClosetMate Logo" className="auth-logo-img" />
          </div>
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter your new password below.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="password">New Password</label>
            <input
              className={`form-input${errors.password ? ' invalid' : ''}`}
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              autoFocus
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              className={`form-input${errors.confirmPassword ? ' invalid' : ''}`}
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </div>
      </div>

      <Toast {...toast} />
    </div>
  );
};

export default ResetPassword;
