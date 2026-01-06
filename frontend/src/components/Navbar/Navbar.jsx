import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/Logo.png';
import { WardrobeIcon } from '../';
import './Navbar.css';

const Navbar = () => {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  return (
    <>
      <nav>
        <Link to="/" className="nav-logo">
          <img src={logo} alt="logo" />
        </Link>
        <div className="nav-links">
          <button className="nav-icon menu-btn" onClick={toggleDrawer} aria-label="Open Menu">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="30" 
              height="30" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="4" x2="20" y1="12" y2="12"/>
              <line x1="4" x2="20" y1="6" y2="6"/>
              <line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Fancy Drawer Support */}
      <div 
        className={`drawer-overlay ${isDrawerOpen ? 'active' : ''}`} 
        onClick={toggleDrawer}
      ></div>
      
      <aside className={`fancy-drawer ${isDrawerOpen ? 'active' : ''}`}>
        <div className="drawer-header">
          <h2>Menu</h2>
          <button className="close-btn" onClick={toggleDrawer}>&times;</button>
        </div>
        
        <div className="drawer-content">
          <Link to="/wardrobe" className="drawer-link" onClick={toggleDrawer}>
            <div className="drawer-icon-cell">
              <WardrobeIcon size={24} />
            </div>
            <div className="drawer-text">
              <span className="link-title">Wardrobe</span>
              <span className="link-desc">Manage your collection</span>
            </div>
          </Link>

          <div className="drawer-link disabled">
            <div className="drawer-icon-cell">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div className="drawer-text">
              <span className="link-title">Community <span className="badge">Soon</span></span>
              <span className="link-desc">Share with others</span>
            </div>
          </div>

          <div className="drawer-link disabled">
            <div className="drawer-icon-cell">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
            </div>
            <div className="drawer-text">
              <span className="link-title">Recommendation <span className="badge">Soon</span></span>
              <span className="link-desc">AI Stylist suggestions</span>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <p>© 2026 ClosetMate</p>
        </div>
      </aside>
    </>
  );
};

export default memo(Navbar);
