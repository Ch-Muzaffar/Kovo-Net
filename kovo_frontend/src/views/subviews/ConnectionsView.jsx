import React, { useState, useEffect } from 'react';
import { useNavigation, useUI, useConnections, useAuth, useDms } from '../../context/AppContext';
import { connectionsApi } from '../../api/connections';
import { supabase } from '../../api/supabase';
import Icon from '../../components/Icon';
import { getAvatarGradient, getInitials } from '../../utils/helpers';

export default function ConnectionsView() {
  const { navigate, navigationParam } = useNavigation();
  const { showToast } = useUI();
  const { user } = useAuth();
  const { removeConnection, fetchConnectionCount } = useConnections();
  const { startDm } = useDms();
  
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent' | 'friends'
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync activeTab with URL hash parameter (navigationParam)
  useEffect(() => {
    if (navigationParam === 'received' || navigationParam === 'sent' || navigationParam === 'friends') {
      setActiveTab(navigationParam);
    }
  }, [navigationParam]);

  // Unified function to refresh all connection lists (bypassing the in-memory cache)
  const refreshAll = async () => {
    try {
      connectionsApi.invalidateCache();
      const [receivedRes, sentRes, friendsRes] = await Promise.all([
        connectionsApi.getReceivedPending(),
        connectionsApi.getSentPending(),
        connectionsApi.getList()
      ]);
      
      const recList = Array.isArray(receivedRes) ? receivedRes : (receivedRes?.data || []);
      const sentList = Array.isArray(sentRes) ? sentRes : (sentRes?.data || []);
      const friendList = Array.isArray(friendsRes) ? friendsRes : (friendsRes?.data || []);
      
      setReceivedRequests(recList);
      setSentRequests(sentList);
      setFriendsList(friendList);
    } catch (err) {
      console.error('Failed to refresh connections:', err);
    }
  };

  // Fetch pending requests and friends on mount
  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      setLoading(true);
      await refreshAll();
      if (active) setLoading(false);
    }
    loadInitialData();
    return () => { active = false; };
  }, []);

  // Real-time connections update subscription via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to all changes on connections table to auto-sync lists instantly
    const channel = supabase
      .channel('connections-realtime-view-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections'
        },
        async () => {
          await refreshAll();
        }
      )
      .subscribe();

    // Local fallback listener: handles WebSocket notifications when running on local Mock DB
    const handleRefreshEvent = async () => {
      await refreshAll();
    };

    window.addEventListener('connection-accepted-refresh', handleRefreshEvent);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('connection-accepted-refresh', handleRefreshEvent);
    };
  }, [user]);

  const handleAccept = async (reqId) => {
    const item = receivedRequests.find(r => r.id === reqId);
    if (!item) return;

    // Optimistic Update
    setReceivedRequests(prev => prev.filter(r => r.id !== reqId));
    showToast('Connection request accepted!', 'success');

    try {
      await connectionsApi.acceptRequest(reqId);
      refreshAll();
      if (user?.id) fetchConnectionCount(user.id);
    } catch (err) {
      showToast(err.message || 'Failed to accept connection request', 'error');
      // Rollback on failure
      setReceivedRequests(prev => [...prev, item].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  };

  const handleIgnore = async (reqId) => {
    const item = receivedRequests.find(r => r.id === reqId);
    if (!item) return;

    // Optimistic Update
    setReceivedRequests(prev => prev.filter(r => r.id !== reqId));
    showToast('Connection request ignored.', 'info');

    try {
      await connectionsApi.deleteRequest(reqId);
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to ignore request', 'error');
      // Rollback
      setReceivedRequests(prev => [...prev, item].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  };

  const handleWithdraw = async (reqId) => {
    const item = sentRequests.find(r => r.id === reqId);
    if (!item) return;

    // Optimistic Update
    setSentRequests(prev => prev.filter(r => r.id !== reqId));
    showToast('Connection request withdrawn.', 'info');

    try {
      await connectionsApi.deleteRequest(reqId);
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to withdraw request', 'error');
      // Rollback
      setSentRequests(prev => [...prev, item].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  };

  const handleUnfriend = async (friend) => {
    const fullName = `${friend.first_name || ''} ${friend.last_name || ''}`.trim() || 'this user';
    if (window.confirm(`Are you sure you want to remove ${fullName} from your connections?`)) {
      try {
        await removeConnection(friend.connectionId);
        // Note: refreshAll will be called in background by context or realtime sub
        refreshAll();
      } catch (err) {
        showToast(err.message || 'Failed to unfriend', 'error');
      }
    }
  };

  const displayList = 
    activeTab === 'received' ? receivedRequests : 
    activeTab === 'sent' ? sentRequests : 
    friendsList;

  return (
    <div className="page-enter">
      <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-4">
        Connection Management
      </h2>

      {/* Tabs */}
      <div 
        style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '1.5rem', 
          gap: '1rem',
          overflowX: 'auto'
        }}
      >
        <button
          onClick={() => setActiveTab('received')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'received' ? '2px solid var(--accent-purple)' : '2px solid transparent',
            color: activeTab === 'received' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          Received Requests ({receivedRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sent' ? '2px solid var(--accent-purple)' : '2px solid transparent',
            color: activeTab === 'sent' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          Sent Requests ({sentRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'friends' ? '2px solid var(--accent-purple)' : '2px solid transparent',
            color: activeTab === 'friends' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          Connections ({friendsList.length})
        </button>
      </div>

      {/* List content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <div 
            className="spinner-sm" 
            style={{ 
              width: '2.2rem', 
              height: '2.2rem', 
              border: '3px solid var(--accent-purple)', 
              borderRightColor: 'transparent' 
            }} 
          />
        </div>
      ) : displayList.length === 0 ? (
        <div className="empty-state card p-8 border border-[var(--border-color)]" style={{ textAlign: 'center' }}>
          <Icon 
            icon={
              activeTab === 'received' ? 'solar:user-plus-bold-duotone' : 
              activeTab === 'sent' ? 'solar:square-share-line-bold-duotone' : 
              'solar:users-group-rounded-bold-duotone'
            } 
            style={{ fontSize: '3.5rem', color: 'var(--text-muted)', opacity: 0.6 }} 
          />
          <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mt-4 mb-2">
            {
              activeTab === 'received' ? 'No connection requests' : 
              activeTab === 'sent' ? 'No requests sent' : 
              'No connections yet'
            }
          </h3>
          <p className="text-sm text-[var(--text-muted)]" style={{ maxWidth: '320px', margin: '0 auto' }}>
            {
              activeTab === 'received' ? 'When other students or professionals invite you to connect, they will show up here.' : 
              activeTab === 'sent' ? 'Keep exploring the feed to find classmates and colleagues to build your network.' :
              'Build your network by sending requests to colleagues or accepting invitations from other members.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(displayList || []).map(item => {
            if (!item) return null;
            
            // Map the layout object based on activeTab
            let partner;
            if (activeTab === 'received') {
              partner = item.sender;
            } else if (activeTab === 'sent') {
              partner = item.receiver;
            } else {
              partner = item; // in 'friends' tab, the item itself is the profile
            }

            const fullName = `${partner?.first_name || ''} ${partner?.last_name || ''}`.trim() || 'Someone';
            const initials = ((partner?.first_name?.[0] || '') + (partner?.last_name?.[0] || '')).toUpperCase() || 'U';
            const avatarColor = getAvatarGradient(partner?.username || fullName);
            
            return (
              <div 
                key={item.id || partner?.id} 
                className="card p-4 flex items-center justify-between border border-[var(--border-color)]"
                style={{ gap: '1rem' }}
              >
                {/* User Info Section */}
                <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
                  {/* Clickable Avatar */}
                  <button 
                    onClick={() => partner?.id && navigate('profile', { userId: partner.id })}
                    disabled={!partner?.id}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: partner?.id ? 'pointer' : 'default', flexShrink: 0 }}
                    title={partner?.id ? `View ${fullName}'s profile` : ''}
                  >
                    {partner?.avatar_url ? (
                      <img 
                        src={partner.avatar_url} 
                        alt={fullName} 
                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div 
                        className="avatar flex items-center justify-center text-white font-bold"
                        style={{ background: avatarColor, width: '44px', height: '44px', borderRadius: '50%', fontSize: '1rem' }}
                      >
                        {initials}
                      </div>
                    )}
                  </button>

                  {/* Name and headline/bio */}
                  <div className="min-w-0">
                    <button 
                      className={`text-sm font-semibold text-[var(--text-primary)] ${partner?.id ? 'hover:underline cursor-pointer' : ''} flex items-center gap-1`}
                      onClick={() => partner?.id && navigate('profile', { userId: partner.id })}
                      disabled={!partner?.id}
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontWeight: 'bold' }}
                    >
                      {fullName}
                      {partner?.id && <Icon icon="solar:link-round-angle-bold-duotone" style={{ fontSize: '0.85rem', opacity: 0.6 }} />}
                    </button>
                    <div className="text-xs text-[var(--text-muted)] truncate" style={{ maxWidth: '320px' }}>
                      {partner?.profession || 'Network Member'}
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeTab === 'received' && (
                    <>
                      <button 
                        className="btn-gradient px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                        onClick={() => handleAccept(item.id)}
                        style={{ borderRadius: '12px', border: 'none', color: '#fff', cursor: 'pointer' }}
                      >
                        <Icon icon="solar:check-read-bold" style={{ fontSize: '1rem' }} /> Accept
                      </button>
                      <button 
                        className="btn-ghost px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                        onClick={() => handleIgnore(item.id)}
                        style={{ 
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          background: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        <Icon icon="solar:close-square-bold" style={{ fontSize: '1rem' }} /> Ignore
                      </button>
                    </>
                  )}

                  {activeTab === 'sent' && (
                    <button 
                      className="btn-ghost px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                      onClick={() => handleWithdraw(item.id)}
                      style={{ 
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        background: 'none',
                        color: 'rgba(239, 68, 68, 0.85)',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" style={{ fontSize: '1rem' }} /> Withdraw
                    </button>
                  )}

                  {activeTab === 'friends' && (
                    <>
                      <button 
                        className="btn-gradient px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                        onClick={() => startDm({
                          id: partner.id,
                          username: partner.username,
                          firstName: partner.first_name,
                          lastName: partner.last_name,
                          department: partner.profession || '',
                          avatar_url: partner.avatar_url
                        })}
                        style={{ borderRadius: '12px', border: 'none', color: '#fff', cursor: 'pointer' }}
                      >
                        <Icon icon="solar:chat-round-line-bold" style={{ fontSize: '1rem' }} /> Message
                      </button>
                      <button 
                        className="btn-ghost px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                        onClick={() => handleUnfriend(partner)}
                        style={{ 
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          background: 'none',
                          color: 'rgba(239, 68, 68, 0.85)',
                          cursor: 'pointer'
                        }}
                      >
                        <Icon icon="solar:user-minus-bold" style={{ fontSize: '1rem' }} /> Unfriend
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
