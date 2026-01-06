import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar, LogoutButton } from './components';
import useAuthStore from './store/authStore';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home/Home'));
const Wardrobe = lazy(() => import('./pages/Wardrobe/Wardrobe'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const Logout = lazy(() => import('./pages/Auth/Logout'));

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
  const authRoutes = ['/login', '/register', '/logout'];
  
  if (authRoutes.includes(pathname)) return null;
  
  return (
    <>
      <Navbar />
      <LogoutButton />
    </>
  );
};

function App() {
  const init = useAuthStore(state => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Router>
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
          
          <Route path="/logout" element={<Logout />} />
          
          {/* Catch all - Redirect to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App;