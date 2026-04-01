import React from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import "./Home.css";

const features = [
  {
    path: "/wardrobe",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    title: "Wardrobe",
    description: "Upload and organize your clothing items with automatic background removal.",
  },
  {
    path: "/outfits",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
    ),
    title: "Outfits",
    description: "Let AI generate stylish outfit combinations from your wardrobe.",
  },
  {
    path: "/community",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Community",
    description: "Share your outfits, discover styles, and react to looks from others.",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <main className="home-container">
      <div className="home-hero">
        <h1 className="main-header">
          {user ? `Hi, ${(user.full_name || user.name || '').split(' ')[0]}` : 'Welcome to ClosetMate'}
        </h1>
        <p className="main-sub-heading">
          Your smart wardrobe companion — simple, effortless clothing management.
        </p>
        <p className="main-description">
          Digitize your wardrobe, remove backgrounds automatically, get AI outfit
          suggestions, and share your style with a growing community.
        </p>
        <button className="hero-cta" onClick={() => navigate("/wardrobe")}>
          Go to Wardrobe
        </button>
      </div>

      <div className="home-features">
        {user && (
          <button className="feature-card" onClick={() => navigate(`/profile/${user.user_id || user.id}`)}>
            <div className="feature-icon feature-icon-profile">
              <span>{(user.full_name || user.name || 'U').charAt(0).toUpperCase()}</span>
            </div>
            <div className="feature-text">
              <span className="feature-title">My Profile</span>
              <span className="feature-desc">View your stats, shared outfits, and community activity.</span>
            </div>
            <svg className="feature-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        )}
        {features.map((f) => (
          <button key={f.path} className="feature-card" onClick={() => navigate(f.path)}>
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-text">
              <span className="feature-title">{f.title}</span>
              <span className="feature-desc">{f.description}</span>
            </div>
            <svg className="feature-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>
    </main>
  );
};

export default Home;
