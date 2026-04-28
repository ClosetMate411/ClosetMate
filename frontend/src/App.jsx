import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar, LogoutButton } from './components';
import useAuthStore from './store/authStore';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home/Home'));
const Wardrobe = lazy(() => import('./pages/Wardrobe/Wardrobe'));
const Outfits = lazy(() => import('./pages/Outfits/Outfits'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const OtpVerification = lazy(() => import('./pages/Auth/OtpVerification'));
const Logout = lazy(() => import('./pages/Auth/Logout'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const Community = lazy(() => import('./pages/Community/Community'));
const UserProfile = lazy(() => import('./pages/Community/UserProfile'));

// Loading fallback component
const PageLoader = () => (
  <div className="loading-screen-overlay" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="loading-spinner"></div>
  </div>
);

/**
 * Protected Route Component
 */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isLoading = useAuthStore(state => state.isLoading);
  const user = useAuthStore(state => state.user);
  
  // Wait for initialization if session exists but user profile is pending
  const isInitializing = isLoading && !user && localStorage.getItem('token');
  
  if (isInitializing) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return children;
};

const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

/**
 * Navigation component
 * Handles conditional rendering of navbar and floating logout
 */
const Navigation = () => {
  const { pathname } = useLocation();
  const authRoutes = ['/login', '/register', '/logout', '/verify-otp', '/forgot-password', '/reset-password'];
  
  if (authRoutes.includes(pathname)) return null;
  
  return (
    <>
      <Navbar />
      <LogoutButton />
    </>
  );
};

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    const goOffline = () => {
      clearTimeout(reconnectTimer.current);
      setJustReconnected(false);
      setIsOffline(true);
    };
    const goOnline = () => {
      setJustReconnected(true);
      setIsOffline(false);
      reconnectTimer.current = setTimeout(() => setJustReconnected(false), 3000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
      clearTimeout(reconnectTimer.current);
    };
  }, []);

  if (!isOffline && !justReconnected) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, display: 'flex', alignItems: 'center', gap: 10,
      background: justReconnected
        ? 'linear-gradient(135deg,#0f9b58,#07c272)'
        : 'linear-gradient(135deg,#1a1035,#3b1fa8)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 16,
      boxShadow: justReconnected
        ? '0 8px 32px rgba(7,194,114,0.35)'
        : '0 8px 32px rgba(59,31,168,0.45)',
      fontSize: '0.875rem', fontWeight: 600,
      letterSpacing: '0.01em',
      animation: 'offlineSlideUp 0.35s cubic-bezier(0.22,1,0.36,1)',
      whiteSpace: 'nowrap',
    }}>
      <style>{`
        @keyframes offlineSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes offlinePulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.3; }
        }
      `}</style>

      {justReconnected ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Back online!
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1" fill="currentColor" style={{animation:'offlinePulse 1.2s ease-in-out infinite'}}/>
          </svg>
          No internet connection
        </>
      )}
    </div>
  );
}

function App() {
  useEffect(() => {
    useAuthStore.getState().init();

    const handleSessionExpired = () => {
      useAuthStore.getState().clearAuth();
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  return (
    <Router>
      <OfflineBanner />
      <Navigation />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Protected Routes (Authenticated only) */}
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/wardrobe" element={
            <ProtectedRoute>
              <Wardrobe />
            </ProtectedRoute>
          } />
          <Route path="/outfits" element={
            <ProtectedRoute>
              <Outfits />
            </ProtectedRoute>
          } />
          <Route path="/community" element={
            <ProtectedRoute>
              <Community />
            </ProtectedRoute>
          } />
          <Route path="/profile/:userId" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />

          {/* Public Auth Routes (Unauthenticated only) */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-otp" element={<OtpVerification />} />
          
          <Route path="/logout" element={<Logout />} />
          
          {/* Catch all - Redirect to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App;