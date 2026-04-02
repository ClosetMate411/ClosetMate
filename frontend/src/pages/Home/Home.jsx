import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useOutfitStore from "../../store/outfitStore";
import useWardrobeStore from "../../store/wardrobeStore";
import "./Home.css";

const COLOR_MAP = {
  black: '#1a1a1a', white: '#f5f5f5', gray: '#9ca3af', navy: '#1e3a5f',
  blue: '#3b82f6', red: '#ef4444', burgundy: '#800020', pink: '#ec4899',
  green: '#22c55e', olive: '#808000', yellow: '#eab308', orange: '#f97316',
  purple: '#a855f7', brown: '#92400e', tan: '#d2b48c', beige: '#f5f0e1',
  cream: '#fffdd0', khaki: '#c3b091', charcoal: '#36454f', denim: '#6892d5',
};

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
  const { stats, fetchStats } = useOutfitStore();
  const { items } = useWardrobeStore();
  const [compareIds, setCompareIds] = useState([null, null]);
  const { outfits } = useOutfitStore();

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompareSelect = useCallback((index, outfitId) => {
    setCompareIds(prev => {
      const next = [...prev];
      next[index] = outfitId;
      return next;
    });
  }, []);

  const compareOutfits = compareIds.map(id => outfits.find(o => o.id === id) || null);

  return (
    <main className="home-container">
      <div className="home-hero">
        <h1 className="main-header">Welcome to ClosetMate</h1>
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

      {/* ── Wardrobe Stats Dashboard ─────────────────────── */}
      {stats && stats.total_items > 0 && (
        <div className="stats-dashboard">
          <h2 className="stats-title">Your Wardrobe at a Glance</h2>

          <div className="stats-summary">
            <div className="stats-card">
              <span className="stats-number">{stats.total_items}</span>
              <span className="stats-label">Items</span>
            </div>
            <div className="stats-card">
              <span className="stats-number">{stats.total_outfits}</span>
              <span className="stats-label">Outfits</span>
            </div>
            <div className="stats-card">
              <span className="stats-number">{Object.keys(stats.categories || {}).length}</span>
              <span className="stats-label">Categories</span>
            </div>
            <div className="stats-card">
              <span className="stats-number">{stats.dominant_style || '-'}</span>
              <span className="stats-label">Top Style</span>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="stats-section">
            <h3 className="stats-section-title">Category Breakdown</h3>
            <div className="stats-bars">
              {Object.entries(stats.categories || {}).map(([cat, count]) => (
                <div key={cat} className="stats-bar-row">
                  <span className="stats-bar-label">{cat}</span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{ width: `${(count / stats.total_items) * 100}%` }}
                    />
                  </div>
                  <span className="stats-bar-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div className="stats-section">
            <h3 className="stats-section-title">Your Color Palette</h3>
            <div className="stats-colors">
              {(stats.top_colors || []).map((color) => (
                <div key={color} className="stats-color-chip">
                  <span
                    className="stats-color-dot"
                    style={{ background: COLOR_MAP[color] || '#ccc' }}
                  />
                  <span className="stats-color-name">{color}</span>
                  <span className="stats-color-count">{(stats.colors || {})[color]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Style Distribution */}
          <div className="stats-section">
            <h3 className="stats-section-title">Style Mix</h3>
            <div className="stats-tags">
              {Object.entries(stats.styles || {}).map(([style, count]) => (
                <span key={style} className="stats-tag">
                  {style} <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Outfit Comparison ────────────────────────────── */}
      {outfits.length >= 2 && (
        <div className="compare-section">
          <h2 className="stats-title">Compare Outfits</h2>
          <div className="compare-grid">
            {[0, 1].map((idx) => (
              <div key={idx} className="compare-slot">
                <select
                  className="compare-select"
                  value={compareIds[idx] || ''}
                  onChange={(e) => handleCompareSelect(idx, e.target.value || null)}
                >
                  <option value="">Select outfit...</option>
                  {outfits.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>

                {compareOutfits[idx] && (
                  <div className="compare-card">
                    <div className="compare-items">
                      {compareOutfits[idx].item_ids
                        .map(id => items.find(i => i.id === id))
                        .filter(Boolean)
                        .map(item => (
                          <img key={item.id} src={item.image} alt={item.name} className="compare-item-img" referrerPolicy="no-referrer" />
                        ))
                      }
                    </div>
                    <div className="compare-meta">
                      <h4 className="compare-name">{compareOutfits[idx].name}</h4>
                      <div className="compare-badges">
                        {compareOutfits[idx].style && <span className="meta-tag">{compareOutfits[idx].style}</span>}
                        {compareOutfits[idx].occasion && <span className="meta-tag">{compareOutfits[idx].occasion}</span>}
                        {compareOutfits[idx].cohesion_score && (
                          <span className="compare-score">{compareOutfits[idx].cohesion_score}/10</span>
                        )}
                      </div>
                      {compareOutfits[idx].reasoning && (
                        <p className="compare-reasoning">{compareOutfits[idx].reasoning}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
