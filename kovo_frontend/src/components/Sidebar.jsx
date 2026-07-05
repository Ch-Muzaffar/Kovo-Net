import React from 'react';
import { useTheme, useUI, useAuth, useNavigation, usePosts, useNotifications, useConnections } from '../context/AppContext';
import Icon from './Icon';
import { usersApi } from '../api/users.js';
import { connectionsApi } from '../api/connections.js';

export default function Sidebar() {
  const { darkMode, toggleDarkMode } = useTheme();
  const { openModal } = useUI();
  const { user, logout } = useAuth();
  const { view, navigate } = useNavigation();
  const { bookmarkedPosts } = usePosts();
  const { notifications } = useNotifications();
  const { pendingConnections } = useConnections();

  const unreadNotifs = notifications.some(n => !n.read);
  const bookmarkCount = bookmarkedPosts.size;
  const pendingCount = pendingConnections?.length || 0;

  const navItems = [
    { id: 'feed', label: 'Home', icon: 'solar:home-2-bold-duotone' },
    { id: 'messages', label: 'Messages', icon: 'solar:chat-round-line-bold-duotone' },
    { id: 'connections', label: 'Connections', icon: 'solar:users-group-rounded-bold-duotone', badge: pendingCount > 0, badgeCount: pendingCount },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'solar:bookmark-bold-duotone', badge: bookmarkCount > 0, badgeCount: bookmarkCount },
    { id: 'profile', label: 'Profile', icon: 'solar:user-circle-bold-duotone' },
    { id: 'feedback', label: 'Feedback', icon: 'solar:chat-square-like-bold-duotone' },
  ];

  const mobileNavItems = [
    { id: 'feed', label: 'Home', icon: 'solar:home-2-bold-duotone' },
    { id: 'messages', label: 'Messages', icon: 'solar:chat-round-line-bold-duotone' },
    { id: 'create-post', label: 'Post', icon: 'lucide:plus', isSpecial: true },
    { id: 'notifications', label: 'Notifications', icon: 'solar:bell-bold-duotone', badge: unreadNotifs },
    { id: 'profile', label: 'Profile', icon: 'solar:user-circle-bold-duotone' },
  ];

  // Helper to check if a navigation item is active
  const isItemActive = (id) => {
    if (id === 'feed') {
      return view === 'feed' || view === 'post-detail';
    }
    return view === id;
  };

  const handleNavClick = (id) => {
    navigate(id);
  };

  return (
    <>
      {/* Desktop Pill Sidebar */}
      <nav id="pill-sidebar" role="navigation" aria-label="Main navigation">

        {/* New Post Button */}
        <button 
          className="pill-new-post" 
          onClick={() => openModal('create-post')} 
          aria-label="New Post"
        >
          <Icon icon="solar:add-circle-bold-duotone" style={{ fontSize: '1.25rem', flexShrink: 0 }} />
          <span className="pill-new-post-label">New Post</span>
        </button>
 
        {/* Nav Items */}
        <div className="pill-nav">
          {navItems.map(item => {
            const active = isItemActive(item.id);
            return (
              <button 
                key={item.id}
                className={`pill-nav-item ${active ? 'active' : ''}`} 
                onClick={() => handleNavClick(item.id)}
                onMouseEnter={() => {
                  if (item.id === 'profile' && user?.id) usersApi.prefetchFullProfile(user.id);
                  if (item.id === 'connections') connectionsApi.prefetchPending();
                }}
                onMouseDown={() => {
                  if (item.id === 'profile' && user?.id) usersApi.prefetchFullProfile(user.id);
                  if (item.id === 'connections') connectionsApi.prefetchPending();
                }}
                onTouchStart={() => {
                  if (item.id === 'connections') connectionsApi.prefetchPending();
                }}
                aria-current={active ? 'page' : 'false'} 
                aria-label={item.label}
              >
                <span className="pill-item-icon" style={{ position: 'relative' }}>
                  <Icon icon={item.icon} style={{ fontSize: '1.35rem' }} />
                  {item.badge && !item.badgeCount && <span className="pill-notif-dot" />}
                  {item.badgeCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-6px',
                      background: 'var(--accent-purple)', color: '#fff',
                      borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 700,
                      minWidth: '16px', height: '16px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', lineHeight: 1,
                    }}>{item.badgeCount}</span>
                  )}
                </span>
                <span className="pill-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
 
        {/* Divider + Sign Out */}
        <div className="pill-divider" />
        <button 
          className="pill-nav-item" 
          style={{ color: 'rgba(248,113,113,0.85)' }} 
          onClick={logout} 
          aria-label="Sign Out"
        >
          <span className="pill-item-icon">
            <Icon icon="solar:logout-3-bold-duotone" style={{ fontSize: '1.35rem' }} />
          </span>
          <span className="pill-item-label">Sign Out</span>
        </button>
      </nav>

      {/* Mobile Nav */}
      <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
        {mobileNavItems.map(item => {
          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                className="mobile-nav-item mobile-nav-special"
                onClick={() => openModal('create-post')}
                aria-label="Create Post"
              >
                <Icon icon={item.icon} style={{ fontSize: '1.75rem', color: '#fff' }} />
              </button>
            );
          }
          const active = isItemActive(item.id);
          return (
            <button 
              key={item.id}
              className={`mobile-nav-item ${active ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              onMouseEnter={() => { if (item.id === 'profile' && user?.id) usersApi.prefetchFullProfile(user.id); }}
              onMouseDown={() => { if (item.id === 'profile' && user?.id) usersApi.prefetchFullProfile(user.id); }}
              onTouchStart={() => { if (item.id === 'profile' && user?.id) usersApi.prefetchFullProfile(user.id); }}
            >
              <span className="relative" style={{ display: 'flex' }}>
                <Icon icon={item.icon} style={{ fontSize: '1.45rem' }} />
                {item.badge && !item.badgeCount && <span className="pill-notif-dot" style={{ top: '-1px', left: '14px' }} />}
                {item.badgeCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-6px',
                    background: 'var(--accent-purple)', color: '#fff',
                    borderRadius: '9999px', fontSize: '0.55rem', fontWeight: 700,
                    minWidth: '14px', height: '14px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '0 2px', lineHeight: 1,
                  }}>{item.badgeCount}</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
