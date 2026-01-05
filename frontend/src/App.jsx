import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home/Home'));
const Wardrobe = lazy(() => import('./pages/Wardrobe/Wardrobe'));

// Loading fallback component
const PageLoader = () => (
  <div className="loading-screen-overlay" style={{ minHeight: '50vh', flexDirection: 'column', gap: '1.5rem' }}>
    <div className="loading-spinner"></div>
    <h3 className="loading-message">Preparing your closet...</h3>
  </div>
);

function App() {
  return (
    <Router>
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App;