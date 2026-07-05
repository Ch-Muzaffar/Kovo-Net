import React from 'react';
import { useNotifications, useConnections, useNavigation } from '../../context/AppContext';
import Icon from '../../components/Icon';
import { timeAgo } from '../../utils/helpers';

export default function NotificationsView() {
  const { notifications, markAllRead } = useNotifications();
  const { respondToConnection, pendingConnections } = useConnections();
  const { navigate } = useNavigation();

  return (
    <div className="page-enter">
      {/* Connection Requests section */}
      {pendingConnections.length > 0 && (
        <div className="mb-6 card p-4 border border-[var(--border-color)]">
          <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Icon icon="lucide:user-check" style={{ color: 'var(--accent-purple)' }} />
            Connection Requests ({pendingConnections.length})
          </h3>
          <div className="space-y-3">
            {pendingConnections.map(req => {
              const sender = req.sender || {};
              const name = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Someone';
              const initials = ((sender.first_name?.[0] || '') + (sender.last_name?.[0] || '')).toUpperCase();
              const avatarColor = `linear-gradient(135deg, var(--accent-purple), var(--accent-blue))`;

              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(15,23,42,0.02)] border border-[var(--border-color)]">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('profile', { userId: sender.id })} title="Click to view profile">
                    <div 
                      className="avatar avatar-sm flex items-center justify-center text-white font-bold"
                      style={{ background: avatarColor, width: '36px', height: '36px', borderRadius: '50%', fontSize: '0.85rem' }}
                    >
                      {initials || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)] hover:underline flex items-center gap-1">
                        {name}
                        <Icon icon="lucide:external-link" style={{ fontSize: '0.75rem', opacity: 0.6 }} />
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{sender.profession || 'Network Member'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="btn-gradient px-3 py-1.5 text-xs flex items-center gap-1"
                      onClick={() => respondToConnection(req.id, 'accept')}
                    >
                      <Icon icon="lucide:check" /> Accept
                    </button>
                    <button 
                      className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                      onClick={() => respondToConnection(req.id, 'reject')}
                    >
                      <Icon icon="lucide:x" /> Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-2xl text-[var(--text-primary)]">Notifications</h2>
        {notifications.some(n => !n.read) && (
          <button className="text-sm text-[var(--accent-purple)] hover:underline" onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Mark all as read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state">
          <Icon icon="lucide:bell-off" style={{ fontSize: '3rem' }} />
          <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mt-4">All caught up!</h3>
          <p className="text-sm mt-2">No new notifications right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const typeIcons = { like: 'lucide:heart', comment: 'lucide:message-circle', helpful: 'lucide:check-circle', message: 'lucide:message-square', level: 'lucide:trophy', connection_request: 'lucide:user-plus', connection_accepted: 'lucide:user-check' };
            const typeColors = { like: '#F472B6', comment: 'var(--accent-blue)', helpful: 'var(--success)', message: 'var(--accent-purple)', level: '#FBBF24', connection_request: 'var(--accent-purple)', connection_accepted: 'var(--success)' };
            const isPendingRequest = n.type === 'connection_request' && n.referenceId && pendingConnections.some(pc => pc.id === n.referenceId);
            return (
              <div key={n.id} className={`card p-4 flex items-start gap-3 ${!n.read ? 'border-l-2 border-l-[var(--accent-purple)]' : ''}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${typeColors[n.type]}20` }}>
                  <Icon icon={typeIcons[n.type]} style={{ fontSize: '1rem', color: typeColors[n.type] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {n.content}
                    {n.postId && (
                      <button className="text-[var(--accent-purple)] hover:underline ml-1.5" onClick={() => navigate('post-detail', { postId: n.postId })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        View Post
                      </button>
                    )}
                    {n.type === 'connection_request' && (
                      <button 
                        className="text-[var(--accent-purple)] hover:underline ml-1.5 font-semibold" 
                        onClick={() => navigate('connections', { tab: 'received' })} 
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        Manage Invites
                      </button>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                  
                  {isPendingRequest && (() => {
                    const matchingReq = pendingConnections.find(pc => pc.id === n.referenceId);
                    const sender = matchingReq?.sender;
                    return (
                      <div className="mt-3 flex flex-col gap-2">
                        {sender && (
                          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)] bg-[rgba(15,23,42,0.03)] p-2.5 rounded-lg border border-[var(--border-color)]">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="avatar avatar-sm flex-shrink-0" style={{ width: '28px', height: '28px', fontSize: '0.75rem', background: `linear-gradient(135deg, var(--accent-purple), var(--accent-blue))` }}>
                                {((sender.first_name?.[0] || '') + (sender.last_name?.[0] || '')).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-[var(--text-primary)] block leading-tight">{sender.first_name} {sender.last_name}</span>
                                <span className="text-[10px] text-[var(--text-muted)] block truncate">{sender.profession || 'Network Member'}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => navigate('profile', { userId: sender.id })}
                              className="btn-secondary px-2 py-1 text-[10px] font-semibold flex items-center gap-1 flex-shrink-0"
                              style={{ borderRadius: 'var(--radius-sm)' }}
                            >
                              <Icon icon="lucide:user" style={{ fontSize: '0.75rem' }} /> Profile
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button 
                            className="btn-gradient px-3 py-1.5 text-xs flex items-center gap-1"
                            onClick={() => respondToConnection(n.referenceId, 'accept')}
                          >
                            <Icon icon="lucide:check" /> Accept
                          </button>
                          <button 
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                            onClick={() => respondToConnection(n.referenceId, 'reject')}
                          >
                            <Icon icon="lucide:x" /> Decline
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
