import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const Logout = () => {
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    const performLogout = async () => {
      await logout();
      // Requirement 1.4.2 & 1.4.3
      navigate('/login');
    };
    
    performLogout();
  }, [navigate, logout]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-header">
          <div className="logout-icon">👋</div>
          <h1 className="auth-title">Logging out...</h1>
        </div>
      </div>
    </div>
  );
};

export default Logout;
