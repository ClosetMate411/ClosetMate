import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/Logo.png';
import { WardrobeIcon } from '../';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav>
      <Link to="/" className="nav-logo">
        <img src={logo} alt="logo" />
      </Link>
      <Link to="/wardrobe" className="nav-icon">
        <WardrobeIcon size={30} />
      </Link>
    </nav>
  );
};

export default memo(Navbar);

