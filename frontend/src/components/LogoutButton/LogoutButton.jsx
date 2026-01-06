import React from 'react';
import { Link } from 'react-router-dom';
import './LogoutButton.css';

const LogoutButton = () => {
  return (
    <Link to="/logout" className="floating-logout-btn" title="Logout">
      <div className="logout-content">
        <span className="logout-text">Logout</span>
        <svg 
          viewBox="0 0 24 24" 
          width="18" 
          height="18" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
          <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
      </div>
    </Link>
  );
};

export default LogoutButton;
