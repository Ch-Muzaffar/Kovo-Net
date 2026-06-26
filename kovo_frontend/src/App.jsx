import React from 'react';
import { useApp } from './context/AppContext';
import Landing from './views/Landing';
import Login from './views/Login';
import Register from './views/Register';
import Feed from './views/Feed';
import ModalRoot from './components/ModalRoot';
import ToastContainer from './components/ToastContainer';

// ─── Error Boundary: shows the exact error instead of a white screen ───
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[KOVO NETWORKS ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#f1f5f9'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem',
            maxWidth: '600px', textAlign: 'center', wordBreak: 'break-word'
          }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            style={{
              padding: '0.5rem 1.5rem', borderRadius: '0.5rem', border: 'none',
              background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isLoggedIn, view, loading } = useApp();

  // While token validation is in-flight, show a neutral splash
  // (prevents flickering to the landing page on refresh when already logged in)
  const isRestoringSession = !isLoggedIn && typeof loading === 'object'
    && window.location.hash.match(/^\#\/(feed|explore|bookmarks|notifications|messages|profile|post|settings)/);

  if (isRestoringSession) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', flexDirection: 'column', gap: '1rem'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(15,118,110,0.2)', borderTopColor: '#0F766E',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
          Restoring your session…
        </p>
      </div>
    );
  }

  if (isLoggedIn) {
    return <Feed />;
  }

  switch (view) {
    case 'landing':
      return <Landing />;
    case 'login':
      return <Login />;
    case 'register':
      return <Register />;
    default:
      return <Landing />;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <ModalRoot />
      <ToastContainer />
    </ErrorBoundary>
  );
}
