import React, { useState, useEffect } from 'react';
import { useNavigation, useAuth, useUI, useDms, useConnections } from '../../context/AppContext';
import Icon from '../../components/Icon';
import PostCard from '../../components/PostCard';
import { usersApi } from '../../api/users.js';
import { postsApi } from '../../api/posts.js';
import { connectionsApi } from '../../api/connections.js';
import { getAvatarGradient, getInitials, getLevelInfo, optimizeCloudinaryUrl } from '../../utils/helpers';

export default function ProfileView() {
  const { profileViewUserId, navigate } = useNavigation();
  const { user, updateUser } = useAuth();
  const { showToast, openModal } = useUI();
  const { dmConversations, startDm } = useDms();
  const {
    sendConnectionRequest,
    withdrawConnectionRequest,
    respondToConnection,
    removeConnection,
    fetchConnectionCount,
    connectionCounts,
    setConnectionCounts
  } = useConnections();

  const [profileUser, setProfileUser] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Inline edit state
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ firstName: '', lastName: '', bio: '', department: '', skills: '' });
  const [profileEditSaving, setProfileEditSaving] = useState(false);

  // Connection state
  const [profileConnectionStatus, setProfileConnectionStatus] = useState('none');
  const [profileConnectionId, setProfileConnectionId] = useState(null);

  const activeUserId = profileViewUserId || user?.id;
  const isOwn = activeUserId === user?.id;

  useEffect(() => {
    let isMounted = true;
    
    if (!profileUser || profileUser.id !== activeUserId) {
      setLoadingProfile(true);
    }

    const loadProfileData = async () => {
      try {
        const res = await usersApi.getFullProfile(activeUserId);
        const { profile, posts: rawPosts, connectionCount, connectionStatus, connectionId } = res;

        const firstName = profile.first_name || profile.firstName || '';
        const lastName = profile.last_name || profile.lastName || '';
        const autoUsername = `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '') || 'user';
        const profileData = {
          id: profile.id,
          username: profile.username || autoUsername,
          firstName,
          lastName,
          department: profile.profession || profile.department || '',
          bio: profile.bio || '',
          type: profile.user_type || 'student',
          points: profile.points || 0,
          level: profile.level || 1,
          skills: profile.master_skills || [],
          profileComplete: profile.is_profile_complete || false,
        };

        const normalizedUserPosts = (rawPosts || []).map(p => ({
          id: p.id,
          userId: p.user_id || p.userId,
          title: p.title || '',
          content: p.body || p.content || '',
          body: p.body || p.content || '',
          tags: (p.tags || []).map(t => (typeof t === 'string' ? t : t.tag_value || t.value || '')).filter(Boolean),
          attachments: p.attachments || [],
          likes: p.likes || 0,
          comments: p.comments_count || p.comments || 0,
          createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
          isTarget: p.isTarget || false,
          creator: profileData,
          is_hidden: p.is_hidden || false,
        }));

        if (isMounted) {
          setProfileUser(profileData);
          setProfilePosts(normalizedUserPosts);
          setProfileConnectionStatus(connectionStatus || 'none');
          setProfileConnectionId(connectionId || null);
          setConnectionCounts(prev => ({ ...prev, [activeUserId]: connectionCount || 0 }));
        }
      } catch (err) {
        if (isMounted) {
          showToast('Failed to load profile details: ' + (err.message || ''), 'error');
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [profileViewUserId, user, setConnectionCounts, showToast, activeUserId]);

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner-sm" style={{ width: '2rem', height: '2rem', border: '3px solid var(--accent-purple)', borderRightColor: 'transparent' }}></div>
      </div>
    );
  }

  const u = profileUser;
  if (!u) return <div className="empty-state"><p>User not found</p></div>;

  const lvl = getLevelInfo(u.points);
  const userPosts = profilePosts;
  const completion = u.profileComplete ? 100 : 40;

  return (
    <div className="page-enter">
      {!isOwn && (
        <button 
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors" 
          onClick={() => navigate('feed')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Icon icon="lucide:arrow-left" style={{ fontSize: '1rem' }} /> Back to Feed
        </button>
      )}

      {/* Profile Header */}
      <div className="card p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: getAvatarGradient(u.username) }}></div>

        {/* Edit button — top-right corner (own profile only) */}
        {isOwn && !profileEditing && (
          <button
            onClick={() => {
              setProfileEditForm({
                firstName: u.firstName || '',
                lastName: u.lastName || '',
                bio: u.bio || '',
                department: u.department || '',
                skills: (u.skills || []).join(', ')
              });
              setProfileEditing(true);
            }}
            title="Edit profile"
            style={{
              position: 'absolute', top: '1rem', right: '1rem', zIndex: 20,
              background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(6px)',
              transition: 'all 0.2s',
            }}
          >
            <Icon icon="lucide:pencil" style={{ fontSize: '0.8rem' }} /> Edit Profile
          </button>
        )}

        {profileEditing ? (
          /* ── Inline Edit Form ── */
          <div className="relative z-10">
            <h3 className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Edit Your Profile</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>First Name</label>
                <input className="input-field" value={profileEditForm.firstName} onChange={e => setProfileEditForm(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Last Name</label>
                <input className="input-field" value={profileEditForm.lastName} onChange={e => setProfileEditForm(p => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bio</label>
              <textarea className="input-field" rows="2" value={profileEditForm.bio} onChange={e => setProfileEditForm(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Department</label>
                <input className="input-field" value={profileEditForm.department} onChange={e => setProfileEditForm(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Skills (comma-separated)</label>
                <input className="input-field" value={profileEditForm.skills} onChange={e => setProfileEditForm(p => ({ ...p, skills: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-gradient px-5 py-2 text-sm flex items-center gap-2"
                disabled={profileEditSaving}
                onClick={async () => {
                  setProfileEditSaving(true);
                  const skillsArray = profileEditForm.skills.split(',').map(s => s.trim()).filter(Boolean);
                  try {
                    await usersApi.updateProfile({ bio: profileEditForm.bio, master_skills: skillsArray });
                    const demoUpdates = {};
                    if (profileEditForm.firstName && profileEditForm.firstName !== u.firstName) demoUpdates.first_name = profileEditForm.firstName;
                    if (profileEditForm.lastName && profileEditForm.lastName !== u.lastName) demoUpdates.last_name = profileEditForm.lastName;
                    if (profileEditForm.department && profileEditForm.department !== u.department) demoUpdates.profession = profileEditForm.department;
                    if (Object.keys(demoUpdates).length > 0) {
                      await usersApi.updateDemographics(demoUpdates);
                    }
                    updateUser({ firstName: profileEditForm.firstName, lastName: profileEditForm.lastName, bio: profileEditForm.bio, department: profileEditForm.department, skills: skillsArray, profileComplete: true });
                    setProfileUser(prev => ({ ...prev, firstName: profileEditForm.firstName, lastName: profileEditForm.lastName, bio: profileEditForm.bio, department: profileEditForm.department, skills: skillsArray }));
                    showToast('Profile updated!', 'success');
                    setProfileEditing(false);
                  } catch (err) {
                    showToast('Failed to save: ' + (err.message || ''), 'error');
                  } finally {
                    setProfileEditSaving(false);
                  }
                }}
              >
                {profileEditSaving ? <><div className="spinner-sm" style={{ width: '0.8rem', height: '0.8rem' }} /> Saving…</> : <><Icon icon="lucide:check" style={{ fontSize: '0.875rem' }} /> Save Changes</>}
              </button>
              <button className="btn-ghost px-4 py-2 text-sm" onClick={() => setProfileEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          /* ── Normal Profile View ── */
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative flex-shrink-0">
              {u.avatar_url ? (
                <img
                  src={optimizeCloudinaryUrl(u.avatar_url)}
                  alt={u.username}
                  className="avatar avatar-xl"
                  style={{ objectFit: 'cover', borderRadius: '50%', width: '4rem', height: '4rem' }}
                />
              ) : (
                <div className="avatar avatar-xl" style={{ background: getAvatarGradient(u.username) }}>
                  {getInitials(u.firstName + ' ' + u.lastName)}
                </div>
              )}
              {isOwn && (
                <button
                  onClick={() => navigate('settings')}
                  title="Change profile photo"
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: 'var(--gradient-btn)', border: '2px solid white',
                    borderRadius: '50%', width: '22px', height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Icon icon="lucide:camera" style={{ fontSize: '0.7rem', color: '#fff' }} />
                </button>
              )}
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 mb-1">
                <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">{u.firstName} {u.lastName}</h2>
                <span className={`badge ${lvl.cls}`}>{lvl.name}</span>
                {u.type === 'student' ? (
                  <span className="badge" style={{ background: 'rgba(15,118,110,0.1)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.2)' }}>Student</span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(2,132,199,0.1)', color: '#0284C7', border: '1px solid rgba(2,132,199,0.2)' }}>Professional</span>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">@{u.username} · {u.department}{u.country ? ` · ${u.city}, ${u.country}` : ''}</p>
              {u.bio && <p className="text-sm text-[var(--text-secondary)] mb-3">{u.bio}</p>}
              <div className="flex items-center gap-4 justify-center sm:justify-start text-sm">
                <span className="text-[var(--text-muted)]"><strong className="text-[var(--text-primary)]">{userPosts.length}</strong> Posts</span>
                <span className="text-[var(--text-muted)]"><strong className="text-[var(--text-primary)]">{u.points}</strong> Points</span>
                <span className="text-[var(--text-muted)]"><strong className="text-[var(--text-primary)]">{lvl.name}</strong> Level</span>
                <span className="text-[var(--text-muted)]">
                  <strong className="text-[var(--text-primary)]">
                    {connectionCounts[u.id] !== undefined ? connectionCounts[u.id] : 0}
                  </strong> Connections
                </span>
              </div>

              {/* Connection controls — only for other users */}
              {!isOwn && (
                <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '0.75rem' }}>
                  {profileConnectionStatus === 'none' && (
                    <button
                      className="btn-gradient px-5 py-2 text-sm flex items-center gap-2"
                      style={{ borderRadius: '9999px' }}
                      onClick={async () => {
                        try {
                          const result = await sendConnectionRequest(u.id);
                          setProfileConnectionStatus('pending_sent');
                          if (result?.id) {
                            setProfileConnectionId(result.id);
                          }
                        } catch {
                          // Already handled by toast in sendConnectionRequest
                        }
                      }}
                    >
                      <Icon icon="lucide:user-plus" style={{ fontSize: '0.9rem' }} />
                      Add Friend
                    </button>
                  )}

                  {profileConnectionStatus === 'pending_sent' && (
                    <button
                      className="btn-secondary px-5 py-2 text-sm flex items-center gap-2"
                      style={{ borderRadius: '9999px', borderColor: 'var(--warning, #F59E0B)', color: 'var(--warning, #D97706)', transition: 'all 0.2s' }}
                      onClick={async () => {
                        if (!profileConnectionId) {
                          showToast('Could not find connection request.', 'error');
                          return;
                        }
                        await withdrawConnectionRequest(profileConnectionId);
                        setProfileConnectionStatus('none');
                        setProfileConnectionId(null);
                      }}
                    >
                      <Icon icon="lucide:user-minus" style={{ fontSize: '0.9rem' }} />
                      Withdraw Request
                    </button>
                  )}

                  {profileConnectionStatus === 'pending_received' && (
                    <>
                      <button
                        className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"
                        style={{ borderRadius: '9999px' }}
                        onClick={async () => {
                          await respondToConnection(profileConnectionId, 'accept');
                          setProfileConnectionStatus('connected');
                          fetchConnectionCount(u.id);
                        }}
                      >
                        <Icon icon="lucide:user-check" style={{ fontSize: '0.9rem' }} />
                        Accept Request
                      </button>
                      <button
                        className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                        style={{ borderRadius: '9999px' }}
                        onClick={async () => {
                          await respondToConnection(profileConnectionId, 'reject');
                          setProfileConnectionStatus('rejected');
                        }}
                      >
                        <Icon icon="lucide:user-x" style={{ fontSize: '0.9rem' }} />
                        Ignore
                      </button>
                    </>
                  )}

                  {profileConnectionStatus === 'connected' && (
                    <button
                      className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 hover:border-red-400 hover:text-red-400 transition-colors"
                      style={{ borderRadius: '9999px' }}
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to remove ${u.firstName} from your connections?`)) {
                          try {
                            await removeConnection(profileConnectionId);
                            setProfileConnectionStatus('none');
                            setProfileConnectionId(null);
                            if (u.id) {
                              await fetchConnectionCount(u.id);
                            }
                          } catch (err) {
                            showToast('Failed to unfriend: ' + (err.message || ''), 'error');
                          }
                        }
                      }}
                    >
                      <Icon icon="lucide:user-minus" style={{ fontSize: '0.9rem' }} />
                      Unfriend
                    </button>
                  )}

                  <button
                    className="btn-gradient px-5 py-2 text-sm flex items-center gap-2"
                    style={{ borderRadius: '9999px' }}
                    onClick={() => startDm({
                      id: u.id,
                      username: u.username,
                      firstName: u.firstName,
                      lastName: u.lastName,
                      department: u.department || '',
                      avatar_url: u.avatar_url
                    })}
                  >
                    <Icon icon="lucide:message-circle" style={{ fontSize: '0.9rem' }} />
                    {dmConversations.some(c => c.participantId === u.id) ? 'Continue Chat' : 'Message'}
                  </button>
                </div>
              )}

              {isOwn && !u.profileComplete && (
                <div className="mt-3 max-w-xs">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">Profile Completion</span>
                    <span className="text-[var(--accent-pink)] font-semibold">{completion}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${completion}%` }}></div>
                  </div>
                  <p className="text-xs text-[var(--warning)] mt-1">
                    <Icon icon="lucide:alert-triangle" style={{ fontSize: '0.75rem', display: 'inline', marginRight: '4px' }} />
                    80% point penalty —{' '}
                    <button className="text-[var(--accent-purple)] underline" onClick={() => navigate('settings')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      Complete profile
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {u.skills && u.skills.length > 0 && !profileEditing && (
          <div className="relative z-10 flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-[var(--border-color)]">
            {u.skills.map(s => (
              <span key={s} className="tag">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* User Posts */}
      <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mb-4">{isOwn ? 'Your Posts' : `${u.username}'s Posts`}</h3>
      {userPosts.length === 0 ? (
        <div className="empty-state">
          <Icon icon="lucide:file-text" style={{ fontSize: '2.5rem' }} />
          <p className="text-sm mt-2">{isOwn ? "You haven't posted anything yet." : 'No posts yet.'}</p>
          {isOwn && (
            <button className="btn-gradient px-5 py-2 text-sm mt-4" onClick={() => openModal('create-post')}>
              Create Your First Post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {userPosts.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
