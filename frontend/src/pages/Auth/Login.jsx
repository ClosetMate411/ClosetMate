import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../hooks';
import logo from '../../assets/Logo.png';
import { Toast } from '../../components';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const { toast, showError, showSuccess } = useToast();
  const hasShownLogoutMsg = useRef(false);
  
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: '',
  });

  // Handle flash messages from redirects (like logout)
  useEffect(() => {
    if (location.state?.message && !hasShownLogoutMsg.current) {
      showSuccess(location.state.message);
      hasShownLogoutMsg.current = true;
      
      // Clear the location state so the message doesn't persist on refresh/re-render
      navigate(location.pathname, { replace: true, state: { ...location.state, message: undefined } });
    }
  }, [location, showSuccess, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    // Reset password field on attempt
    const result = await login(formData);

    if (result.success) {

      navigate('/');
    } else {
      // The error message from backend (e.g. "Invalid email or password")
      // is now correctly parsed by the apiService and passed here.
      showError(result.error || 'Login failed');
      setFormData(prev => ({ ...prev, password: '' }));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img src={logo} alt="ClosetMate Logo" className="auth-logo-img" />
          </div>
          <h1 className="auth-title">Login</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              className="form-input"
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/register" className="auth-link">Don't have an account? Register</Link>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast {...toast} />
    </div>
  );
};

export default Login;
