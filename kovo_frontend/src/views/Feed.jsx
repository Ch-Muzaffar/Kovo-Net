import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard from '../components/PostCard';
import Icon from '../components/Icon';
import { getAvatarGradient, getInitials, getLevelInfo, timeAgo } from '../utils/helpers';
import { usersApi } from '../api/users.js';
import { postsApi } from '../api/posts.js';
import { api } from '../api/client.js';

export default function Feed() {
  const { 
    view,
    user, 
    updateUser,
    posts, 
    comments, 
    addComment,
    loadComments,
    helpfulComments, 
    toggleHelpful,
    voteHelpful,
    getVoteCounts,
    reportedContent, 
    searchQuery, 
    setSearchQuery,
    selectedPostId, 
    selectedThreadId,
    profileViewUserId,
    navigate,
    notifications, 
    markAllRead,
    messages,
    dmConversations,
    activeDmUserId,
    setActiveDmUserId,
    startDm,
    sendDm,
    openModal,
    showToast,
    bookmarkedPosts,
    deleteAccount,
    uploadFileToCloudinary
  } = useApp();

  // Settings local state
  const [settingsForm, setSettingsForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.bio || '',
    department: user?.department || '',
    skills: (user?.skills || []).join(', ')
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const avatarInputRef = useRef(null);
  const dmAttachmentRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [dmUploading, setDmUploading] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailComments: true,
    pushLikes: true,
    weeklyDigest: false
  });

  // Profile subview states
  const [profileUser, setProfileUser] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Comment input state
  const [commentInput, setCommentInput] = useState('');

  // DM input state
  const [dmInput, setDmInput] = useState('');

  // Profile inline-edit state
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ firstName: '', lastName: '', bio: '', department: '', skills: '' });
  const [profileEditSaving, setProfileEditSaving] = useState(false);

  // Mobile search toggle state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  if (!user) return null;

  // 1. FILTER & SORT POSTS BASED ON ACTIVE VIEW / SEARCH
  let displayPosts = [...posts];

  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    displayPosts = displayPosts.filter(p => {
      if (!p) return false;
      const contentMatch = p.content && typeof p.content === 'string' && p.content.toLowerCase().includes(q);
      const tagsMatch = Array.isArray(p.tags) && p.tags.some(t => t && typeof t === 'string' && t.toLowerCase().includes(q));
      // Match by creator username / first+last name (user ID search)
      const creator = p.creator;
      const creatorMatch = creator && (
        (creator.username && creator.username.toLowerCase().includes(q)) ||
        (creator.firstName && creator.firstName.toLowerCase().includes(q)) ||
        (creator.lastName && creator.lastName.toLowerCase().includes(q)) ||
        (`${creator.firstName || ''} ${creator.lastName || ''}`.toLowerCase().trim().includes(q))
      );
      return contentMatch || tagsMatch || creatorMatch;
    });
  }

  // Home Feed sorting (Target vs Discover)
  if (view === 'feed') {
    displayPosts.sort((a, b) => {
      if (a.isTarget && !b.isTarget) return -1;
      if (!a.isTarget && b.isTarget) return 1;
      return b.createdAt - a.createdAt;
    });
  } else if (view === 'explore') {
    displayPosts.sort((a, b) => b.likes - a.likes);
  } else if (view === 'bookmarks') {
    displayPosts = displayPosts.filter(p => bookmarkedPosts.has(p.id));
  }

  // 2. COMMENTS SUBMIT
  const handleCommentSubmit = (postId) => {
    if (!commentInput.trim()) {
      showToast('Comment text cannot be empty.', 'warning');
      return;
    }
    addComment(postId, commentInput.trim());
    setCommentInput('');
    showToast('Comment posted!', 'success');
  };

  // 3. SETTINGS FORM SUBMIT — saves to backend
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    const skillsArray = settingsForm.skills.split(',').map(s => s.trim()).filter(Boolean);
    try {
      // Update profile fields (bio, skills)
      await usersApi.updateProfile({
        bio: settingsForm.bio,
        master_skills: skillsArray,
      });
      // Update demographics fields (name, profession) if changed
      const demoUpdates = {};
      if (settingsForm.firstName && settingsForm.firstName !== user.firstName) demoUpdates.first_name = settingsForm.firstName;
      if (settingsForm.lastName && settingsForm.lastName !== user.lastName) demoUpdates.last_name = settingsForm.lastName;
      if (settingsForm.department && settingsForm.department !== user.department) demoUpdates.profession = settingsForm.department;
      if (Object.keys(demoUpdates).length > 0) {
        await usersApi.updateDemographics(demoUpdates);
      }
      updateUser({
        firstName: settingsForm.firstName,
        lastName: settingsForm.lastName,
        bio: settingsForm.bio,
        department: settingsForm.department,
        skills: skillsArray,
        profileComplete: true
      });
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to save profile: ' + (err.message || ''), 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  // 3b. AVATAR PHOTO UPLOAD
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type (iPhone may report empty or 'application/octet-stream' for HEIC)
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['png', 'jpg', 'jpeg', 'heic', 'heif'];
    const allowedMimes = ['image/png', 'image/jpeg', 'image/heic', 'image/heif'];
    let mimeType = file.type;
    
    // Fix iPhone HEIC detection - browsers may not set mime for HEIC
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (ext === 'heic') mimeType = 'image/heic';
      else if (ext === 'heif') mimeType = 'image/heif';
    }
    
    if (!allowedMimes.includes(mimeType) && !allowedExts.includes(ext)) {
      showToast('Only PNG, JPG, JPEG, and HEIC (iPhone) images are allowed.', 'error');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }
    
    setAvatarUploading(true);
    try {
      const fileSize = file.size;
      const presignRes = await api.get(`/uploads/presign?mime_type=${encodeURIComponent(mimeType)}&file_size=${fileSize}`);
      const { signature, timestamp, apiKey, uploadPreset, uploadUrl } = presignRes.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      if (uploadPreset) formData.append('upload_preset', uploadPreset);
      const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const avatarUrl = uploadData.secure_url;
      await usersApi.updateProfile({ avatar_url: avatarUrl });
      updateUser({ avatar_url: avatarUrl });
      showToast('Profile photo updated!', 'success');
    } catch (err) {
      showToast('Failed to upload photo: ' + (err.message || ''), 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // 4. PREFERENCES TOGGLE
  const togglePref = (key) => {
    setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    showToast('Preference updated.', 'success');
  };

  // Load comments when entering post-detail view
  useEffect(() => {
    if (view === 'post-detail' && selectedPostId) {
      loadComments(selectedPostId);
    }
  }, [view, selectedPostId, loadComments]);

  // Load profile data and posts when entering profile view
  useEffect(() => {
    if (view !== 'profile') return;

    const activeUserId = profileViewUserId || user?.id;
    if (!activeUserId) return;

    let isMounted = true;
    setLoadingProfile(true);

    const loadProfileData = async () => {
      try {
        let profileData = null;
        if (activeUserId === user?.id) {
          profileData = user;
        } else {
          const res = await usersApi.getProfile(activeUserId);
          const firstName = res.first_name || '';
          const lastName = res.last_name || '';
          profileData = {
            id: res.id,
            username: `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '') || 'user',
            firstName,
            lastName,
            department: res.profession || res.department || '',
            bio: res.bio || '',
            type: res.user_type || 'student',
            points: res.points || 0,
            skills: res.master_skills || [],
            profileComplete: res.is_profile_complete || false,
          };
        }

        const postsRes = await postsApi.getUserPosts(activeUserId);
        const normalizedUserPosts = (postsRes.data || []).map(p => ({
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
  }, [view, profileViewUserId, user, showToast]);

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="main-content min-h-screen" style={{ paddingBottom: '4rem', marginLeft: 0, width: '100%' }}>
        {/* Spacer above header for breathing room */}
        <div style={{ height: '1rem' }} />

        {/* Top Bar Header */}
        <header
          className="feed-header sticky top-0 z-30"
          style={{
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
            width: '100%',
            position: 'sticky',
          }}
        >
          <div className="feed-header-inner" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', minHeight: '60px', gap: '8px' }}>

            {/* LEFT BRAND — KOVO NETWORKS */}
            <div className="feed-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              <button
                onClick={() => navigate('feed')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px' }}
                aria-label="Go to home feed"
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '0.75rem', flexShrink: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>KO</div>
                <div className="feed-header-brand-text" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>KOVO NETWORKS</div>
              </button>
            </div>

            {/* CENTER SEARCH — desktop & tablet */}
            <div
              className="feed-header-search"
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 1rem', maxWidth: '560px', margin: '0 auto' }}
            >
              <div className="feed-header-search-inner" style={{ width: '100%', position: 'relative' }}>
                <Icon icon="lucide:search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none', zIndex: 5 }} />
                <input
                  type="search"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingTop: '.65rem',
                    paddingBottom: '.65rem',
                    paddingRight: '1rem',
                    fontSize: '.875rem',
                    width: '100%',
                    borderRadius: '9999px',
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(15,118,110,0.15)',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.6)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  placeholder="Search posts, people, @username..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search"
                />
              </div>
            </div>

            {/* Spacer pushes right group to edge */}
            <div style={{ flex: 1 }} />

            {/* RIGHT GROUP */}
            <div className="feed-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Mobile search toggle */}
              <button
                className="mobile-search-toggle"
                onClick={() => setMobileSearchOpen(v => !v)}
                aria-label="Toggle search"
                aria-expanded={mobileSearchOpen}
                style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '8px', display: 'none', alignItems: 'center', color: 'var(--text-secondary)' }}
              >
                <Icon icon={mobileSearchOpen ? 'lucide:x' : 'lucide:search'} style={{ fontSize: '1.2rem' }} />
              </button>

              <button
                onClick={() => navigate('notifications')}
                aria-label="Notifications"
                style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', position: 'relative' }}
              >
                <Icon icon="lucide:bell" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }} />
                {unreadNotifsCount > 0 && <span className="notif-dot" />}
              </button>

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
            </div>
          </div>

          {/* Mobile slide-down search bar */}
          {mobileSearchOpen && (
            <div style={{ padding: '0.5rem 1rem 0.75rem', borderTop: '1px solid rgba(15,23,42,0.06)', background: 'rgba(248,250,252,0.95)' }}>
              <div style={{ position: 'relative' }}>
                <Icon icon="lucide:search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none', zIndex: 5 }} />
                <input
                  autoFocus
                  type="search"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingTop: '.65rem',
                    paddingBottom: '.65rem',
                    paddingRight: searchQuery ? '2.5rem' : '1rem',
                    fontSize: '.875rem',
                    width: '100%',
                    borderRadius: '9999px',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(15,118,110,0.18)',
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

        {/* Content Area Layout Viewport */}
        <div className="feed-layout-inner" style={{ paddingLeft: '100px', paddingRight: '260px' }}>
          <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem' }}>
            
            {/* VIEW: HOME FEED */}
            {view === 'feed' && (
              <div className="page-enter">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '9999px', padding: '0.35rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-purple)', letterSpacing: '0.01em' }}>
                    <Icon icon="lucide:sparkles" style={{ fontSize: '0.875rem' }} />
                    For You
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curated for your expertise</span>
                </div>

                {displayPosts.length === 0 ? (
                  <div className="empty-state">
                    <Icon icon="lucide:search-x" style={{ fontSize: '3rem' }} />
                    <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mt-4 mb-2">
                      {searchQuery ? 'No results found' : 'No posts yet'}
                    </h3>
                    <p className="text-sm max-w-sm">
                      {searchQuery ? 'Try different keywords or browse by tags.' : 'Be the first to post a problem and get help from the community!'}
                    </p>
                    {!searchQuery && (
                      <button className="btn-gradient px-6 py-2.5 text-sm mt-4" onClick={() => openModal('create-post')}>
                        Create First Post
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayPosts.map(p => <PostCard key={p.id} post={p} />)}
                  </div>
                )}
              </div>
            )}

            {/* VIEW: EXPLORE */}
            {view === 'explore' && (() => {
              const allTags = {};
              posts.forEach(p => (p.tags || []).filter(t => t && typeof t === 'string').forEach(t => { allTags[t] = (allTags[t] || 0) + 1; }));
              const sortedTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]);
              return (
                <div className="page-enter">
                  <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-6">Explore</h2>
                  <div className="mb-8">
                    <h3 className="font-display font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider mb-3">Popular Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {sortedTags.map(([tag, count]) => (
                        <button 
                          key={tag}
                          className="tag text-sm px-3 py-1.5" 
                          onClick={() => {
                            setSearchQuery(tag);
                            navigate('feed');
                          }}
                        >
                          @{tag} <span className="text-[var(--text-muted)] ml-1">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider mb-3">All Posts</h3>
                    <div className="space-y-4">
                      {displayPosts.map(p => <PostCard key={p.id} post={p} />)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* VIEW: BOOKMARKS */}
            {view === 'bookmarks' && (
              <div className="page-enter">
                <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-6">Bookmarks</h2>
                {displayPosts.length === 0 ? (
                  <div className="empty-state">
                    <Icon icon="lucide:bookmark" style={{ fontSize: '3rem' }} />
                    <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mt-4 mb-2">No bookmarks yet</h3>
                    <p className="text-sm">Click the bookmark icon on any post to save it for later.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayPosts.map(p => <PostCard key={p.id} post={p} />)}
                  </div>
                )}
              </div>
            )}

            {/* VIEW: POST DETAIL */}
            {view === 'post-detail' && (() => {
              const activePost = posts.find(p => p.id === selectedPostId);
              if (!activePost) {
                return (
                  <div className="empty-state">
                    <Icon icon="lucide:file-x" style={{ fontSize: '3rem' }} />
                    <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mt-4">Post not found</h3>
                    <button className="btn-ghost px-5 py-2 text-sm mt-4" onClick={() => navigate('feed')}>
                      Back to Feed
                    </button>
                  </div>
                );
              }

              const activeComments = comments[activePost.id] || [];
              const isOwner = activePost.userId === user.id;

              return (
                <div className="page-enter">
                  <button className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors" onClick={() => navigate('feed')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Icon icon="lucide:arrow-left" style={{ fontSize: '1rem' }} /> Back to Feed
                  </button>
                  <PostCard post={activePost} />

                  {/* Comments Section */}
                  <div className="mt-6">
                    <h3 className="font-display font-bold text-lg text-[var(--text-primary)] mb-4">
                      {activeComments.length} Comment{activeComments.length !== 1 ? 's' : ''}
                    </h3>

                    {/* Add Comment */}
                    <div className="card p-4 mb-6">
                      <div className="flex gap-3">
                        <div className="avatar avatar-sm" style={{ background: getAvatarGradient(user?.username) }}>
                          {getInitials((user?.firstName || '') + ' ' + (user?.lastName || ''))}
                        </div>
                        <div className="flex-1">
                          <textarea 
                            className="input-field text-sm" 
                            placeholder="Share your thoughts..." 
                            rows="3" 
                            value={commentInput}
                            onChange={e => setCommentInput(e.target.value)}
                            aria-label="Write a comment"
                          />
                          <div className="flex justify-end mt-2">
                            <button className="btn-gradient px-4 py-2 text-sm" onClick={() => handleCommentSubmit(activePost.id)}>
                              Post Comment
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comments List */}
                    {activeComments.length === 0 ? (
                      <div className="empty-state py-8">
                        <Icon icon="lucide:message-circle" style={{ fontSize: '2rem' }} />
                        <p className="text-sm mt-2">No comments yet. Be the first to share your ideas!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...activeComments].sort((a, b) => a.createdAt - b.createdAt).map(c => {
                          // Build display user from commenter (API) or fall back to current user
                          const cData = c.commenter;
                          const cu = cData
                            ? {
                                id: cData.id || c.userId,
                                username: `${cData.first_name || ''}.${cData.last_name || ''}`.toLowerCase().replace(/\s+/g, '') || 'user',
                                firstName: cData.first_name || '',
                                lastName: cData.last_name || '',
                              }
                            : (c.userId === user?.id ? user : { id: c.userId, username: 'user', firstName: 'Unknown', lastName: '' });
                          if (!cu) return null;
                          const isHelpful = helpfulComments.has(c.id);
                          const canMarkHelpful = isOwner && c.userId !== user.id;
                          return (
                            <div key={c.id} className="card p-4">
                              <div className="flex items-start gap-3">
                                <button onClick={() => navigate('profile', { userId: c.userId })} aria-label={`View ${cu.username}'s profile`} style={{ background: 'none', border: 'none', padding: 0 }}>
                                  <div className="avatar avatar-sm" style={{ background: getAvatarGradient(cu.username) }}>
                                    {getInitials(cu.firstName + ' ' + cu.lastName)}
                                  </div>
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                      className="font-semibold text-sm hover:underline" 
                                      onClick={() => navigate('profile', { userId: c.userId })}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                    >
                                      {cu.username}
                                    </button>
                                    <span className="text-xs text-[var(--text-muted)]">{timeAgo(c.createdAt)}</span>
                                  </div>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                                    {c.content}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
                                    {/* Helpful / Not-Helpful vote buttons — visible to all users */}
                                    {(() => {
                                      const { helpfulCount, notCount, myVote } = getVoteCounts(c.id);
                                      return (
                                        <>
                                          <button
                                            className={`engage-btn text-xs${myVote === 'helpful' ? ' helpful' : ''}`}
                                            onClick={() => voteHelpful(c.id, 'helpful')}
                                            aria-label="Mark comment as helpful"
                                            aria-pressed={myVote === 'helpful'}
                                          >
                                            <Icon icon="lucide:thumbs-up" style={{ fontSize: '0.875rem', fill: myVote === 'helpful' ? 'var(--success)' : 'none' }} />
                                            {helpfulCount > 0 ? helpfulCount : 'Helpful'}
                                          </button>
                                          <button
                                            className={`engage-btn text-xs${myVote === 'not' ? ' not-helpful' : ''}`}
                                            onClick={() => voteHelpful(c.id, 'not')}
                                            aria-label="Mark comment as not helpful"
                                            aria-pressed={myVote === 'not'}
                                          >
                                            <Icon icon="lucide:thumbs-down" style={{ fontSize: '0.875rem', fill: myVote === 'not' ? 'var(--error)' : 'none' }} />
                                            {notCount > 0 ? notCount : 'Not Helpful'}
                                          </button>
                                        </>
                                      );
                                    })()}
                                    {canMarkHelpful && (
                                      <button 
                                        className={`engage-btn text-xs ${isHelpful ? 'helpful pulse-helpful' : ''}`} 
                                        onClick={() => toggleHelpful(c.id)} 
                                        aria-pressed={isHelpful}
                                      >
                                        <Icon icon="lucide:check-circle" style={{ fontSize: '0.875rem' }} />
                                        {isHelpful ? 'Marked Helpful' : 'Mark as Helpful'}
                                      </button>
                                    )}
                                    {isHelpful && !canMarkHelpful && (
                                      <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                                        <Icon icon="lucide:check-circle" style={{ fontSize: '0.875rem' }} /> Helpful
                                      </span>
                                    )}
                                    <button 
                                      className="engage-btn text-xs" 
                                      onClick={() => {
                                        if (reportedContent.has(c.id)) return;
                                        openModal('report', { contentId: c.id, contentType: 'comment' });
                                      }}
                                    >
                                      <Icon icon="lucide:flag" style={{ fontSize: '0.875rem' }} />
                                      {reportedContent.has(c.id) ? 'Reported' : 'Report'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* VIEW: MESSAGES — Full DM Interface */}
            {view === 'messages' && (() => {
              const activeConv = activeDmUserId
                ? dmConversations.find(c => c.participantId === activeDmUserId)
                : null;

              const handleSendDm = () => {
                if (!dmInput.trim() || !activeDmUserId) return;
                sendDm(activeDmUserId, dmInput.trim());
                setDmInput('');
              };

              const handleDmAttachmentUpload = async (e) => {
                const file = e.target.files?.[0];
                if (!file || !activeDmUserId) return;
                
                const ext = file.name.split('.').pop().toLowerCase();
                const allowedExts = ['png', 'jpg', 'jpeg', 'heic', 'heif', 'pdf'];
                const allowedMimes = ['image/png', 'image/jpeg', 'image/heic', 'image/heif', 'application/pdf'];
                let mimeType = file.type;
                
                if (!mimeType || mimeType === 'application/octet-stream') {
                  if (ext === 'heic') mimeType = 'image/heic';
                  else if (ext === 'heif') mimeType = 'image/heif';
                  else if (ext === 'pdf') mimeType = 'application/pdf';
                }
                
                if (!allowedMimes.includes(mimeType) && !allowedExts.includes(ext)) {
                  showToast('Only PNG, JPG, JPEG, HEIC, and PDF files are allowed.', 'error');
                  if (dmAttachmentRef.current) dmAttachmentRef.current.value = '';
                  return;
                }
                
                setDmUploading(true);
                try {
                  const uploaded = await uploadFileToCloudinary(file, file.name);
                  await sendDm(activeDmUserId, uploaded.url);
                  showToast('File sent successfully!', 'success');
                } catch (err) {
                  showToast('Failed to upload attachment: ' + (err.message || ''), 'error');
                } finally {
                  setDmUploading(false);
                  if (dmAttachmentRef.current) dmAttachmentRef.current.value = '';
                }
              };

              return (
                <div className="page-enter" style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 160px)', minHeight: '500px' }}>
                  {/* Conversation List Panel */}
                  <div style={{
                    width: activeConv ? '280px' : '100%', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    transition: 'width 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Messages</h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(15,118,110,0.08)', borderRadius: '9999px', padding: '2px 8px', fontWeight: 600 }}>
                        {dmConversations.length} chats
                      </span>
                    </div>

                    {dmConversations.length === 0 ? (
                      <div className="empty-state" style={{ flex: 1 }}>
                        <Icon icon="lucide:message-square" style={{ fontSize: '3rem' }} />
                        <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)', marginTop: '1rem' }}>No conversations yet</h3>
                        <p className="text-sm" style={{ marginTop: '0.5rem' }}>Visit someone's profile and click <strong>Message</strong> to start a chat.</p>
                      </div>
                    ) : (
                      <div className="space-y-2" style={{ overflowY: 'auto', flex: 1 }}>
                        {dmConversations.map(conv => {
                          const pu = conv.participantUser;
                          const isActive = activeDmUserId === conv.participantId;
                          const lastMsg = conv.messages[conv.messages.length - 1];
                          return (
                            <button
                              key={conv.id}
                              onClick={() => setActiveDmUserId(conv.participantId)}
                              style={{
                                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                                background: isActive ? 'rgba(15,118,110,0.08)' : 'var(--bg-card)',
                                borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem',
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                borderLeft: isActive ? '3px solid var(--accent-purple)' : '3px solid transparent',
                                transition: 'all 0.2s', fontFamily: 'inherit',
                                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                              }}
                            >
                              <div className="avatar" style={{ background: getAvatarGradient(pu?.username || 'u'), flexShrink: 0 }}>
                                {getInitials((pu?.firstName || '') + ' ' + (pu?.lastName || ''))}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {pu?.username || 'User'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {lastMsg ? (lastMsg.senderId === 'me' ? 'You: ' : '') + lastMsg.text : 'Start a conversation…'}
                                </div>
                              </div>
                              {lastMsg && (
                                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {timeAgo(lastMsg.ts)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Active Chat Panel */}
                  {activeConv ? (
                    <div style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 4px 20px rgba(15,23,42,0.04)', overflow: 'hidden'
                    }}>
                      {/* Chat Header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)',
                        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)'
                      }}>
                        <button onClick={() => setActiveDmUserId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                          <Icon icon="lucide:arrow-left" style={{ fontSize: '1.1rem' }} />
                        </button>
                        <div className="avatar avatar-sm" style={{ background: getAvatarGradient(activeConv.participantUser?.username || 'u') }}>
                          {getInitials((activeConv.participantUser?.firstName || '') + ' ' + (activeConv.participantUser?.lastName || ''))}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {activeConv.participantUser?.username || 'User'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {activeConv.participantUser?.department || 'Network Member'}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('profile', { userId: activeConv.participantId })}
                          style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}
                        >
                          <Icon icon="lucide:user" style={{ fontSize: '0.8rem' }} /> View Profile
                        </button>
                      </div>

                      {/* Messages Scroll Area */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {activeConv.messages.length === 0 ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                            <Icon icon="lucide:message-circle" style={{ fontSize: '3rem', opacity: 0.4, marginBottom: '0.75rem' }} />
                            <p style={{ fontSize: '0.875rem' }}>No messages yet. Say hello!</p>
                          </div>
                        ) : (
                          activeConv.messages.map(msg => {
                            const isMe = msg.senderId === 'me';
                            return (
                              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                  maxWidth: '70%', padding: '0.5rem 0.875rem',
                                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                  background: isMe ? 'var(--gradient-btn)' : 'rgba(15,23,42,0.06)',
                                  color: isMe ? '#fff' : 'var(--text-primary)',
                                  fontSize: '0.875rem', lineHeight: 1.5,
                                }}>
                                  {(() => {
                                    const isUrl = msg.text.startsWith('http://') || msg.text.startsWith('https://');
                                    const isImg = isUrl && (
                                      msg.text.includes('.png') || msg.text.includes('.jpg') || 
                                      msg.text.includes('.jpeg') || msg.text.includes('.gif') || 
                                      msg.text.includes('.webp') || msg.text.includes('.heic') || 
                                      msg.text.includes('.heif') || msg.text.includes('/image/')
                                    );
                                    const isPdf = isUrl && msg.text.includes('.pdf');
                                    
                                    if (isImg) {
                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <img src={msg.text} alt="Shared Attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', cursor: 'zoom-in', display: 'block' }} onClick={() => window.open(msg.text, '_blank')} />
                                          <a href={msg.text} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: isMe ? '#e0f2fe' : 'var(--accent-purple)', textDecoration: 'underline' }}>View Full Image</a>
                                        </div>
                                      );
                                    }
                                    if (isPdf) {
                                      return (
                                        <a href={msg.text} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isMe ? '#fff' : 'var(--text-primary)', textDecoration: 'underline' }}>
                                          <Icon icon="lucide:file-text" style={{ fontSize: '1.2rem', color: isMe ? '#fff' : 'var(--accent-purple)' }} />
                                          <span>Shared PDF Document</span>
                                        </a>
                                      );
                                    }
                                    return msg.text;
                                  })()}
                                  <div style={{ fontSize: '0.6rem', opacity: 0.65, marginTop: '2px', textAlign: isMe ? 'right' : 'left' }}>
                                    {timeAgo(msg.ts)}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Message Input */}
                      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.5)' }}>
                        <input
                          type="file"
                          ref={dmAttachmentRef}
                          onChange={handleDmAttachmentUpload}
                          style={{ display: 'none' }}
                          accept="image/*,application/pdf"
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ borderRadius: '9999px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => dmAttachmentRef.current?.click()}
                          disabled={dmUploading}
                          title="Attach Image or PDF"
                        >
                          <Icon icon={dmUploading ? "lucide:loader-2" : "lucide:paperclip"} className={dmUploading ? "animate-spin" : ""} style={{ fontSize: '1.1rem' }} />
                        </button>
                        <input
                          type="text"
                          className="input-field"
                          style={{ flex: 1, borderRadius: '9999px', padding: '0.6rem 1rem' }}
                          placeholder={dmUploading ? "Uploading attachment..." : `Message ${activeConv.participantUser?.username || 'user'}…`}
                          value={dmInput}
                          onChange={e => setDmInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSendDm(); }}
                          aria-label="Type a message"
                          disabled={dmUploading}
                        />
                        <button
                          className="btn-gradient"
                          style={{ borderRadius: '9999px', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleSendDm}
                          disabled={!dmInput.trim() || dmUploading}
                        >
                          <Icon icon="lucide:send" style={{ fontSize: '0.9rem' }} /> Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    dmConversations.length > 0 && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Icon icon="lucide:message-square" style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '0.875rem' }}>Select a conversation to start chatting</p>
                      </div>
                    )
                  )}
                </div>
              );
            })()}


            {/* VIEW: NOTIFICATIONS */}
            {view === 'notifications' && (
              <div className="page-enter">
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
                      const typeIcons = { like: 'lucide:heart', comment: 'lucide:message-circle', helpful: 'lucide:check-circle', message: 'lucide:message-square', level: 'lucide:trophy' };
                      const typeColors = { like: '#F472B6', comment: 'var(--accent-blue)', helpful: 'var(--success)', message: 'var(--accent-purple)', level: '#FBBF24' };
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
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW: PROFILE */}
            {view === 'profile' && (() => {
              const activeUserId = profileViewUserId || user?.id;
              const isOwn = activeUserId === user?.id;

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
                    <button className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors" onClick={() => navigate('feed')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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
                                // Also update demographics if name/department changed
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
                              src={u.avatar_url}
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
                          </div>

                          {/* Message button — only for other users */}
                          {!isOwn && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <button
                                className="btn-gradient px-5 py-2 text-sm flex items-center gap-2"
                                style={{ borderRadius: '9999px' }}
                                onClick={() => startDm({
                                  id: u.id,
                                  username: u.username,
                                  firstName: u.firstName,
                                  lastName: u.lastName,
                                  department: u.department || '',
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
            })()}

            {/* VIEW: SETTINGS */}
            {view === 'settings' && (
              <div className="page-enter">
                <h2 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-6">Settings</h2>
                <div className="space-y-6">
                  {/* Profile Photo */}
                  <div className="card p-6">
                    <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Profile Photo</h3>
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt="Your avatar"
                            style={{ width: '5rem', height: '5rem', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="avatar" style={{ background: getAvatarGradient(user?.username), width: '5rem', height: '5rem', fontSize: '1.5rem' }}>
                            {getInitials((user?.firstName || '') + ' ' + (user?.lastName || ''))}
                          </div>
                        )}
                      </div>
                      <div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          id="avatar-upload"
                          className="hidden"
                          accept="image/png,image/jpeg,.jpg,.jpeg,.png,.heic,.heif,image/heic,image/heif"
                          onChange={handleAvatarUpload}
                        />
                        <button
                          type="button"
                          className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarUploading}
                        >
                          {avatarUploading ? (
                            <><div className="spinner-sm" style={{ width: '0.9rem', height: '0.9rem' }} /> Uploading...</>
                          ) : (
                            <><Icon icon="lucide:upload" style={{ fontSize: '0.9rem' }} /> Upload Photo</>
                          )}
                        </button>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5">PNG, JPG, JPEG, HEIC (iPhone) · Max 10MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="card p-6">
                    <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Profile Information</h3>
                    <form onSubmit={handleSettingsSubmit} noValidate>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">First Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={settingsForm.firstName}
                            onChange={e => setSettingsForm({ ...settingsForm, firstName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Last Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={settingsForm.lastName}
                            onChange={e => setSettingsForm({ ...settingsForm, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
                        <textarea
                          className="input-field"
                          rows="3"
                          placeholder="Tell us about yourself..."
                          value={settingsForm.bio}
                          onChange={e => setSettingsForm({ ...settingsForm, bio: e.target.value })}
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Department / Profession</label>
                          <input
                            type="text"
                            className="input-field"
                            value={settingsForm.department}
                            onChange={e => setSettingsForm({ ...settingsForm, department: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Skills (comma-separated)</label>
                          <input
                            type="text"
                            className="input-field"
                            value={settingsForm.skills}
                            onChange={e => setSettingsForm({ ...settingsForm, skills: e.target.value })}
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-gradient px-6 py-2.5 text-sm flex items-center gap-2" disabled={settingsSaving}>
                        {settingsSaving ? (<><div className="spinner-sm" style={{ width: '0.9rem', height: '0.9rem' }} /> Saving...</>) : 'Save Changes'}
                      </button>
                    </form>
                  </div>

                  {/* Notification Preferences */}
                  <div className="card p-6">
                    <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4">Notifications</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Email notifications for new comments', key: 'emailComments' },
                        { label: 'Push notifications for likes', key: 'pushLikes' },
                        { label: 'Weekly digest email', key: 'weeklyDigest' },
                      ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-secondary)]">{pref.label}</span>
                          <button 
                            className={`toggle-track ${notificationPrefs[pref.key] ? 'active' : ''}`} 
                            onClick={() => togglePref(pref.key)}
                            role="switch" 
                            aria-checked={notificationPrefs[pref.key]} 
                          >
                            <div className="toggle-thumb" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="card p-6 border-red-500/20">
                    <h3 className="font-display font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-[var(--text-muted)] mb-4">Permanently deactivate your account. This will hide your profile from the website, but your data is retained securely in the database.</p>
                    <button 
                      className="px-5 py-2.5 text-sm font-semibold border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors" 
                      onClick={() => {
                        if (window.confirm('Are you absolutely sure you want to delete your account? This will log you out and deactivate your profile.')) {
                          deleteAccount();
                        }
                      }}
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Right Column Discover Panel */}
      <RightPanel />
    </div>
  );
}
