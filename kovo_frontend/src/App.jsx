import React, { useEffect } from 'react';
import { useAuth, useNavigation } from './context/AppContext';
import Landing from './views/Landing';
import Login from './views/Login';
import Register from './views/Register';
import Feed from './views/Feed';
import ModalRoot from './components/ModalRoot';
import ToastContainer from './components/ToastContainer';
import { tokenStorage } from './api/client.js';

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
    console.error('[KOVO NET ErrorBoundary]', error, info);
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
  const { isLoggedIn, sessionRestoring } = useAuth();
  const { view } = useNavigation();

  useEffect(() => {
    if (!isLoggedIn) return;

    const token = tokenStorage.getAccess();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let wsUrl;
    
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
      const urlObj = new URL(apiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${urlObj.host}/ws?token=${encodeURIComponent(token)}`;
    } else {
      wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
    }

    let socket;
    let reconnectTimeout;

    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[Kovo WS] Connected');
        // PERF: Expose socket globally for direct DM sending
        window.__KOVO_WS__ = socket;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            window.dispatchEvent(new CustomEvent('ws-new-message', { detail: data }));
            // Auto-acknowledge receipt of the message
            if (data.message && data.message.senderId !== 'me') {
              socket.send(JSON.stringify({
                type: 'message_delivered',
                messageId: data.message.id,
                senderId: data.message.senderId
              }));
            }
          } else if (data.type === 'message_delivered') {
            window.dispatchEvent(new CustomEvent('ws-message-delivered', { detail: data }));
          } else if (data.type === 'new_notification') {
            window.dispatchEvent(new CustomEvent('ws-new-notification', { detail: data }));
          } else if (data.type === 'new_post') {
            window.dispatchEvent(new CustomEvent('ws-new-post', { detail: data }));
          } else if (data.type === 'reaction_update') {
            window.dispatchEvent(new CustomEvent('ws-reaction-update', { detail: data }));
          } else if (data.type === 'dm_sent_ack') {
            // PERF: WebSocket DM acknowledged — message was relayed instantly
            window.dispatchEvent(new CustomEvent('ws-dm-ack', { detail: data }));
          } else if (data.type === 'dm_persisted') {
            // PERF: WebSocket DM persisted to database — update with real ID
            window.dispatchEvent(new CustomEvent('ws-dm-persisted', { detail: data }));
          } else if (data.type === 'dm_error') {
            // PERF: WebSocket DM failed — show error
            window.dispatchEvent(new CustomEvent('ws-dm-error', { detail: data }));
          }
        } catch (err) {
          console.error('[Kovo WS] Error parsing message', err);
        }
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = (err) => {
        socket.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      window.__KOVO_WS__ = null;
    };
  }, [isLoggedIn]);

  if (sessionRestoring) {
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
