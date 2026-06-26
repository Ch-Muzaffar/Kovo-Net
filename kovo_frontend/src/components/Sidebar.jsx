import React from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

export default function Sidebar() {
  const { view, navigate, logout, openModal, notifications, bookmarkedPosts } = useApp();

  const unreadNotifs = notifications.some(n => !n.read);
  const bookmarkCount = bookmarkedPosts.size;

  const navItems = [
    { id: 'feed', label: 'Home Feed', icon: 'lucide:home' },
    { id: 'messages', label: 'Messages', icon: 'lucide:message-square' },
    { id: 'notifications', label: 'Notifications', icon: 'lucide:bell', badge: unreadNotifs },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'lucide:bookmark', badge: bookmarkCount > 0, badgeCount: bookmarkCount },
    { id: 'profile', label: 'Profile', icon: 'lucide:user' },
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
          <Icon icon="lucide:plus" style={{ fontSize: '1.1rem', flexShrink: 0 }} />
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
                aria-current={active ? 'page' : 'false'} 
                aria-label={item.label}
              >
                <span className="pill-item-icon" style={{ position: 'relative' }}>
                  <Icon icon={item.icon} />
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
            <Icon icon="lucide:log-out" />
          </span>
          <span className="pill-item-label">Sign Out</span>
        </button>
      </nav>

      {/* Mobile Nav */}
      <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
        {navItems.map(item => {
          const active = isItemActive(item.id);
          return (
            <button 
              key={item.id}
              className={`mobile-nav-item ${active ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="relative">
                <Icon icon={item.icon} style={{ fontSize: '1.25rem' }} />
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
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
