import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BroadcastTicker from './components/BroadcastTicker';
import ProtectedRoute from './components/ProtectedRoute';

// Stores
import { useAuthStore } from './store/useAuthStore';
import { useLanguageStore } from './store/useLanguageStore';
import { useThemeStore } from './store/useThemeStore';
import { useSocketStore } from './store/useSocketStore';

// صفحات رئيسية
import { PushService } from './services/pushService';
import { authSession } from './services/authSession';
import './i18n';
import './index.css';

// Lazy loading for all pages
const Home = React.lazy(() => import('./pages/Home'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Upload = React.lazy(() => import('./pages/Upload'));
const Explore = React.lazy(() => import('./pages/Explore'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Friends = React.lazy(() => import('./pages/Friends'));
const Search = React.lazy(() => import('./pages/Search'));
const Challenges = React.lazy(() => import('./pages/Challenges'));
const Messages = React.lazy(() => import('./pages/Messages'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
const LiveChat = React.lazy(() => import('./pages/LiveChat'));
const LiveDiscovery = React.lazy(() => import('./pages/LiveDiscovery'));
const LiveStreamHost = React.lazy(() => import('./pages/LiveStreamHost'));
const LiveStreamViewer = React.lazy(() => import('./pages/LiveStreamViewer'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const FontTest = React.lazy(() => import('./pages/FontTest'));
const Groups = React.lazy(() => import('./pages/Groups'));
const VideoDetail = React.lazy(() => import('./pages/VideoDetail'));

const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const VerifyResetCode = React.lazy(() => import('./pages/VerifyResetCode'));
const NewPassword = React.lazy(() => import('./pages/NewPassword'));

const DashboardSkeleton = () => (
  <div className="p-4 space-y-4 animate-pulse">
    <div className="h-40 bg-[var(--card-bg)] rounded-xl"></div>
    <div className="h-64 bg-[var(--card-bg)] rounded-xl"></div>
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-[var(--card-bg)] rounded-xl"></div>
      <div className="h-32 bg-[var(--card-bg)] rounded-xl"></div>
    </div>
  </div>
);

function AppContent() {
  const { direction, isRTL, init: initLang } = useLanguageStore();
  const { theme, init: initTheme } = useThemeStore();
  const { user, init: initAuth } = useAuthStore();
  const { connect, disconnect, updateToken } = useSocketStore();

  useEffect(() => {
    initAuth();
    initLang();
    initTheme();
  }, []);

  useEffect(() => {
    if (user) {
      const token = authSession.getAccessToken();
      if (token) connect(token);

      const setupPush = async () => {
        try {
          const permission = await PushService.checkPermission();
          if (permission === 'default') {
            setTimeout(() => PushService.requestPermission(), 5000);
          } else if (permission === 'granted') {
            PushService.registerAndSubscribe();
          }
        } catch (error) {
          console.error('Push setup error:', error);
        }
      };
      setupPush();
    } else {
      disconnect();
    }
  }, [user]);

  // Sync token refreshes with socket
  useEffect(() => {
    const handleTokenRefresh = (e: any) => {
      if (e.detail?.token) updateToken(e.detail.token);
    };
    window.addEventListener('token_refreshed', handleTokenRefresh);
    return () => window.removeEventListener('token_refreshed', handleTokenRefresh);
  }, [updateToken]);

  return (
    <div
      dir={direction}
      className={`min-h-screen transition-all duration-500 ease-in-out ${theme === 'dark' ? 'dark' : ''
        } ${isRTL ? 'font-arabic' : 'font-english'}`}
    >
      <Navbar />
      <div className="flex h-full">
        <Sidebar aria-label="Main Navigation" />
        <main className={`flex-1 relative transition-all duration-300 bg-[var(--bg-base)] ${isRTL ? 'lg:mr-64' : 'lg:ml-64'}`}>
          <BroadcastTicker />
          <React.Suspense fallback={<DashboardSkeleton />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={user ? <Navigate to={`/profile/${user.username}`} replace /> : <Navigate to="/login" replace />} />
              <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
              <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/live" element={<ProtectedRoute><LiveDiscovery /></ProtectedRoute>} />
              <Route path="/live/host" element={<ProtectedRoute><LiveStreamHost /></ProtectedRoute>} />
              <Route path="/live/:id" element={<ProtectedRoute><LiveStreamViewer /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
              <Route path="/live-chat" element={<ProtectedRoute><LiveChat /></ProtectedRoute>} />
              <Route path="/video/:id" element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
              <Route path="/font-test" element={<FontTest />} />
              <Route path="/verify-email" element={<Navigate to="/" replace />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-reset-code" element={<VerifyResetCode />} />
              <Route path="/reset-password" element={<NewPassword />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
