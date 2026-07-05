import React, { useState, useRef } from 'react';
import { useNavigation, useAuth, useSearch, useNotifications, useDms, useTheme } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import Icon from '../components/Icon';
import { getAvatarGradient, getInitials, getLevelInfo } from '../utils/helpers';
import { usersApi } from '../api/users.js';
import { connectionsApi } from '../api/connections.js';

// Lazy load subviews to minimize initial render memory overload
const MainFeedView = React.lazy(() => import('./subviews/MainFeedView'));
const ExploreView = React.lazy(() => import('./subviews/ExploreView'));
const BookmarksView = React.lazy(() => import('./subviews/BookmarksView'));
const PostDetailView = React.lazy(() => import('./subviews/PostDetailView'));
const NotificationsView = React.lazy(() => import('./subviews/NotificationsView'));
const MessagesView = React.lazy(() => import('./subviews/MessagesView'));
const ProfileView = React.lazy(() => import('./subviews/ProfileView'));
const SettingsView = React.lazy(() => import('./subviews/SettingsView'));
const FeedbackView = React.lazy(() => import('./subviews/FeedbackView'));
const ConnectionsView = React.lazy(() => import('./subviews/ConnectionsView'));

export default function Feed() {
  const { view, navigate } = useNavigation();
  const { user, logout } = useAuth();
  const { searchQuery, searchedUsers, setSearchQuery } = useSearch();
  const { notifications } = useNotifications();
  const { startDm } = useDms();
  const { darkMode, toggleDarkMode } = useTheme();

  // Mobile search toggle state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  // Mobile header dropdown menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  // Close mobile menu on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  if (!user) return null;

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex min-h-screen" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="main-content min-h-screen" style={{ paddingBottom: '4rem', marginLeft: 0, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Top Bar Header — sticky desktop / fixed pill mobile */}
        <header
          className="feed-header sticky top-0 z-30"
          style={{
            background: 'var(--bg-glass-nav)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
            borderRadius: '9999px',
            margin: '12px 12px 16px 12px',
            width: 'calc(100% - 24px)',
            position: 'sticky',
            top: '12px',
          }}
        >
          <div className="feed-header-inner" style={{ display: 'flex', alignItems: 'center', padding: '0 1.25rem', minHeight: '52px', gap: '8px', position: 'relative' }}>

            {/* LEFT BRAND — KOVO stacked */}
            <div className="feed-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              <button
                onClick={() => navigate('feed')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px' }}
                aria-label="Go to home feed"
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '0.7rem', flexShrink: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>KN</div>
                <div className="feed-header-brand-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px', lineHeight: 1 }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>KOVO</span>
                  <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.28em', lineHeight: 1, textTransform: 'uppercase', width: '100%', textAlign: 'center', display: 'block' }}>NET</span>
                </div>
              </button>
            </div>

            {/* CENTER SEARCH CONTAINER — Aligned with feed content */}
            <div className="feed-header-search-container">
              <div className="feed-header-search-inner">
                <Icon icon="lucide:search" style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none', zIndex: 5 }} />
                <input
                  type="text"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingTop: '.65rem',
                    paddingBottom: '.65rem',
                    paddingRight: searchQuery ? '2.5rem' : '1rem',
                    fontSize: '.875rem',
                    width: '100%',
                    borderRadius: '9999px',
                    background: 'var(--bg-glass-input)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  placeholder="Search posts, people, tags, @username..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '26px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    aria-label="Clear search"
                  >
                    <Icon icon="lucide:x" style={{ fontSize: '1rem' }} />
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT GROUP */}
            <div className="feed-header-right" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>

              {/* Mobile search toggle — shown on mobile only via CSS */}
              <button
                className="mobile-search-toggle"
                onClick={() => setMobileSearchOpen(v => !v)}
                aria-label="Toggle search"
                aria-expanded={mobileSearchOpen}
                style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '8px', display: 'none', alignItems: 'center', color: 'var(--text-secondary)' }}
              >
                <Icon icon={mobileSearchOpen ? 'lucide:x' : 'lucide:search'} style={{ fontSize: '1.2rem' }} />
              </button>

              {/* Theme Toggle — always visible on desktop, hidden in mobile header bar */}
              <button
                id="feed-theme-toggle"
                className="header-desktop-only"
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={darkMode}
                title={darkMode ? 'Light Mode' : 'Dark Mode'}
                style={{
                  background: darkMode ? 'rgba(212,160,23,0.12)' : 'rgba(15,23,42,0.04)',
                  border: `1px solid ${darkMode ? 'rgba(212,160,23,0.30)' : 'var(--border-color)'}`,
                  cursor: 'pointer', borderRadius: '10px', padding: '7px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                }}
              >
                <Icon
                  icon={darkMode ? 'solar:sun-bold-duotone' : 'solar:moon-stars-bold-duotone'}
                  style={{ fontSize: '1.15rem', color: darkMode ? '#E5B82A' : 'var(--text-secondary)' }}
                />
              </button>

              {/* Notifications — always visible on desktop, hidden in mobile header bar */}
              <button
                className="header-desktop-only"
                onClick={() => navigate('notifications')}
                aria-label="Notifications"
                style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', position: 'relative' }}
              >
                <Icon icon="lucide:bell" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }} />
                {unreadNotifsCount > 0 && <span className="notif-dot" />}
              </button>

              {/* Profile button */}
              <button
                onClick={() => navigate('profile')}
                aria-label="Your profile"
                style={{ border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', borderRadius: '12px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <div className="avatar avatar-sm" style={{ background: getAvatarGradient(user?.username) }}>
                  {getInitials((user?.firstName || '') + ' ' + (user?.lastName || ''))}
                </div>
                <div className="feed-header-username" style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{user?.username || ''}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--accent-purple)', fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {getLevelInfo(user?.points || 0).name} · {user?.points || 0}pts
                  </div>
                </div>
              </button>

              {/* Mobile-only hamburger "more" menu */}
              <div ref={mobileMenuRef} style={{ position: 'relative' }} className="mobile-menu-toggle">
                <button
                  id="feed-mobile-menu-btn"
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label="More options"
                  aria-expanded={mobileMenuOpen}
                  style={{
                    background: mobileMenuOpen ? 'rgba(15,118,110,0.10)' : 'none',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer', borderRadius: '10px', padding: '7px 9px',
                    display: 'flex', alignItems: 'center',
                    color: 'var(--text-secondary)', transition: 'all 0.2s',
                  }}
                >
                  <Icon icon="solar:menu-dots-bold-duotone" style={{ fontSize: '1.2rem' }} />
                </button>

                {/* Dropdown menu */}
                {mobileMenuOpen && (
                  <div
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      minWidth: '200px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '18px',
                      boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
                      padding: '8px',
                      zIndex: 10000,
                      opacity: 1,
                      animation: 'slideDown 0.2s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                    role="menu"
                  >
                    {[
                      { id: 'explore',   label: 'Explore',    icon: 'solar:compass-bold-duotone' },
                      { id: 'notifications', label: 'Notifications', icon: 'solar:bell-bold-duotone' },
                      { id: 'toggle-theme', label: darkMode ? 'Light Mode' : 'Dark Mode', icon: darkMode ? 'solar:sun-bold-duotone' : 'solar:moon-stars-bold-duotone' },
                      { id: 'connections', label: 'Connections', icon: 'solar:users-group-rounded-bold-duotone' },
                      { id: 'bookmarks', label: 'Bookmarks',  icon: 'solar:bookmark-bold-duotone' },
                      { id: 'messages',  label: 'Messages',   icon: 'solar:chat-round-line-bold-duotone' },
                      { id: 'feedback',  label: 'Feedback',   icon: 'solar:chat-square-like-bold-duotone' },
                    ].map(item => (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => {
                          if (item.id === 'toggle-theme') {
                            toggleDarkMode();
                          } else {
                            navigate(item.id);
                          }
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                          padding: '10px 14px', borderRadius: '12px',
                          fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.18s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(15,118,110,0.06)';
                          if (item.id === 'connections') connectionsApi.prefetchPending();
                        }}
                        onMouseDown={() => {
                          if (item.id === 'connections') connectionsApi.prefetchPending();
                        }}
                        onTouchStart={() => {
                          if (item.id === 'connections') connectionsApi.prefetchPending();
                        }}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <Icon icon={item.icon} style={{ fontSize: '1.2rem', color: 'var(--accent-purple)', flexShrink: 0 }} />
                          <span>{item.label}</span>
                        </div>
                        {item.id === 'notifications' && unreadNotifsCount > 0 && (
                          <span style={{
                            background: 'var(--accent-purple)', color: '#fff',
                            borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700,
                            minWidth: '16px', height: '16px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            padding: '0 4px', lineHeight: 1,
                          }}>{unreadNotifsCount}</span>
                        )}
                      </button>
                    ))}

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '6px 8px' }} />

                    <button
                      role="menuitem"
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                        padding: '10px 14px', borderRadius: '12px',
                        fontSize: '0.875rem', fontWeight: 700, color: 'var(--error)',
                        opacity: 1,
                        background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Icon icon="solar:logout-3-bold-duotone" style={{ fontSize: '1.2rem', flexShrink: 0, color: 'var(--error)' }} />
                      <span style={{ opacity: 1 }}>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Mobile slide-down search bar */}
          {mobileSearchOpen && (
            <div className="feed-header-search mobile-visible">
              <div style={{ position: 'relative', width: '100%' }}>
                <Icon icon="lucide:search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none', zIndex: 5 }} />
                <input
                  autoFocus
                  type="text"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingTop: '.65rem',
                    paddingBottom: '.65rem',
                    paddingRight: searchQuery ? '2.5rem' : '1rem',
                    fontSize: '.875rem',
                    width: '100%',
                    borderRadius: '9999px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                  placeholder="Search posts, people, @username..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    aria-label="Clear search"
                  >
                    <Icon icon="lucide:x" style={{ fontSize: '1rem' }} />
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        <div className="feed-layout-inner" style={{ paddingLeft: '100px', paddingRight: '260px' }}>
          <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem' }}>

            {searchQuery && searchedUsers && searchedUsers.length > 0 && (
              <div className="card p-5 mb-5 page-enter" style={{ border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <h3 className="font-display font-bold text-sm text-[var(--accent-purple)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Icon icon="lucide:users" style={{ fontSize: '1.1rem' }} />
                  People ({searchedUsers.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {searchedUsers.map(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                    const initials = ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username[0]?.toUpperCase();
                    const avatarColor = `linear-gradient(135deg, var(--accent-purple), var(--accent-blue))`;
                    
                    return (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[rgba(139,92,246,0.04)] transition-colors">
                        <button
                          onClick={() => navigate('profile', { userId: u.id })}
                          onMouseEnter={() => usersApi.prefetchFullProfile(u.id)}
                          onMouseDown={() => usersApi.prefetchFullProfile(u.id)}
                          onTouchStart={() => usersApi.prefetchFullProfile(u.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={fullName}
                              style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="avatar" style={{ background: avatarColor, width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-sm text-[var(--text-primary)] hover:underline">{fullName}</div>
                            <div className="text-xs text-[var(--text-muted)]">@{u.username} · {u.profession || u.user_type || 'Member'}</div>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-gradient px-3 py-1.5 text-xs font-semibold"
                            onClick={() => {
                              const normalizedUser = {
                                id: u.id,
                                username: u.username,
                                firstName: u.first_name,
                                lastName: u.last_name,
                                avatar_url: u.avatar_url
                              };
                              startDm(normalizedUser);
                            }}
                          >
                            Message
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Render active subview lazily */}
            <React.Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="spinner-sm" style={{ width: '2rem', height: '2rem', border: '3px solid var(--accent-purple)', borderRightColor: 'transparent' }}></div>
              </div>
            }>
              {view === 'feed' && <MainFeedView />}
              {view === 'explore' && <ExploreView />}
              {view === 'bookmarks' && <BookmarksView />}
              {view === 'post-detail' && <PostDetailView />}
              {view === 'notifications' && <NotificationsView />}
              {view === 'messages' && <MessagesView />}
              {view === 'profile' && <ProfileView />}
              {view === 'settings' && <SettingsView />}
              {view === 'feedback' && <FeedbackView />}
              {view === 'connections' && <ConnectionsView />}
            </React.Suspense>

          </div>
        </div>
      </main>

      {/* Right Column Discover Panel */}
      <RightPanel />
    </div>
  );
}
