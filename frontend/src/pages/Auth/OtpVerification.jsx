import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../hooks';
import logo from '../../assets/ClosetMate_Logo.svg';
import { Toast } from '../../components';
import './Auth.css';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, verifyLogin, resendCode, isLoading } = useAuthStore();
  const { toast, showError, showSuccess } = useToast();

  const email = location.state?.email;
  const purpose = location.state?.purpose; // 'register' | 'login'

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  // Redirect if landed here without context
  useEffect(() => {
    if (!email || !purpose) {
      navigate('/login', { replace: true });
    }
  }, [email, purpose, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  const focusInput = (index) => {
    inputRefs.current[index]?.focus();
  };

  const handleDigitChange = (index, value) => {
    // Allow only single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      showError('Please enter the complete 6-digit code.');
      return;
    }

    if (purpose === 'register') {
      const result = await verifyEmail(email, code);
      if (result.success) {
        navigate('/login', {
          state: { message: 'Email verified! You can now log in.' }
        });
      } else {
        showError(result.error || 'Invalid or expired code.');
        setDigits(Array(OTP_LENGTH).fill(''));
        focusInput(0);
      }
    } else {
      const result = await verifyLogin(email, code);
      if (result.success) {
        navigate('/');
      } else {
        showError(result.error || 'Invalid or expired code.');
        setDigits(Array(OTP_LENGTH).fill(''));
        focusInput(0);
      }
    }
  }, [digits, email, purpose, isLoading, verifyEmail, verifyLogin, navigate, showError]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isLoading) return;
    const result = await resendCode(email, purpose);
    if (result.success) {
      showSuccess('A new code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN);
    } else {
      showError(result.error || 'Failed to resend code. Please try again.');
    }
  }, [cooldown, isLoading, email, purpose, resendCode, showSuccess, showError]);

  const isRegister = purpose === 'register';

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src={logo} alt="ClosetMate Logo" className="auth-logo-img" />
          </div>
          <h1 className="auth-title">{isRegister ? 'Verify Email' : 'Two-Factor Auth'}</h1>
          <p className="auth-subtitle">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="otp-inputs">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                className="otp-box"
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={isLoading}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Didn't receive it?</span>
          <button
            type="button"
            className="resend-button"
            onClick={handleResend}
            disabled={cooldown > 0 || isLoading}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>

      <Toast {...toast} />
    </div>
  );
};

export default OtpVerification;
