import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../services/api.service';
import { useToast } from '../../hooks';
import logo from '../../assets/ClosetMate_Logo.svg';
import { Toast } from '../../components';
import './Auth.css';

const RESEND_COOLDOWN = 60;

const ForgotPassword = () => {
  const { toast, showError } = useToast();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const submitRequest = useCallback(
    async (targetEmail) => {
      setIsLoading(true);
      try {
        await apiService.forgotPassword(targetEmail);
        setSent(true);
        startCooldown();
      } catch (err) {
        showError(err.message || 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [startCooldown, showError]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError('');
    await submitRequest(trimmed);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) return;
    await submitRequest(email.trim());
  };

  // ── Success state ──────────────────────────────────────
  if (sent) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logout-icon" aria-hidden="true">✉️</div>
            <h1 className="auth-title">Check your inbox</h1>
            <p className="auth-subtitle">
              We sent password reset instructions to{' '}
              <strong>{email}</strong>
            </p>
          </div>

          <div className="auth-footer" style={{ marginTop: '1rem' }}>
            <span>Didn't receive it?</span>
            <button
              type="button"
              className="resend-button"
              onClick={handleResend}
              disabled={cooldown > 0 || isLoading}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
            </button>
          </div>

          <div className="auth-footer">
            <Link to="/login" className="auth-link">Back to Login</Link>
          </div>
        </div>

        <Toast {...toast} />
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src={logo} alt="ClosetMate Logo" className="auth-logo-img" />
          </div>
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              className={`form-input${emailError ? ' invalid' : ''}`}
              type="email"
              id="email"
              name="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              disabled={isLoading}
              autoFocus
            />
            {emailError && <span className="error-message">{emailError}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword;
