import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authApi } from '../api/auth.js';
import { postsApi, commentsApi } from '../api/posts.js';
import { messagesApi } from '../api/messages.js';
import { notificationsApi, usersApi } from '../api/users.js';
import { connectionsApi } from '../api/connections.js';
import { tokenStorage, ApiError, api } from '../api/client.js';

// ─── localStorage persistence helpers ───
const STORAGE_KEYS = {
  LIKED_POSTS: 'kovo_liked_posts',
  BOOKMARKED_POSTS: 'kovo_bookmarked_posts',
  POST_LIKES: 'kovo_post_likes',
};

function loadSetFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore corrupt data */ }
  return new Set();
}

function saveSetToStorage(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* ignore quota errors */ }
}

function loadMapFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveMapToStorage(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ─── Helper: normalise a backend post into the shape the UI expects ───
function normalisePost(p) {
  return {
    id: p.id,
    userId: p.user_id || p.userId,
    title: p.title || '',
    content: p.body || p.content || '',
    body: p.body || p.content || '',
    tags: (p.tags || []).map(t => (typeof t === 'string' ? t : t.tag_value || t.value || '')).filter(Boolean),
    attachments: p.attachments || [],
    files: p.files || [],
    likes: p.likes || 0,
    comments: p.comments_count || p.comments || 0,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : (p.createdAt || Date.now()),
    isTarget: p.isTarget || p.is_target || false,
    creator: p.creator || null,
    is_hidden: p.is_hidden || false,
  };
}

// ─── Helper: normalise a backend comment ───
function normaliseComment(c, postId) {
  return {
    id: c.id,
    postId,
    userId: c.user_id || c.userId || (c.commenter?.id) || '',
    content: c.body || c.content || '',
    helpful: c.is_marked_helpful || c.helpful || false,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : (c.createdAt || Date.now()),
    commenter: c.commenter || null,
  };
}

// ─── Helper: normalise a backend notification ───
function normaliseNotification(n) {
  return {
    id: n.id,
    userId: n.from_user_id || n.userId || null,
    type: n.type === 'new_comment' ? 'comment' : (n.type || 'comment'),
    content: n.content || n.body || '',
    read: n.read || false,
    postId: n.post_id || n.postId || null,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : (n.createdAt || Date.now()),
  };
}

// ─── Helper: build a full user object from backend profile ───
function buildUser(authUser, profile) {
  const firstName = profile?.first_name || '';
  const lastName  = profile?.last_name  || '';
  const autoUsername = `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '') || authUser?.email?.split('@')[0] || 'user';
  return {
    id: authUser?.id || profile?.id || '',
    email: authUser?.email || profile?.email || '',
    username: profile?.username || autoUsername,
    firstName,
    lastName,
    department: profile?.profession || profile?.department || '',
    profession: profile?.profession || '',
    country: profile?.country || '',
    city: profile?.city || '',
    bio: profile?.bio || '',
    type: profile?.user_type || 'student',
    points: profile?.points || 0,
    skills: profile?.master_skills || profile?.skills || [],
    departments: profile?.departments || [],
    hobbies: profile?.hobbies || [],
    avatar_url: profile?.avatar_url || null,
    profileComplete: profile?.is_profile_complete || false,
    tosAccepted: profile?.tos_accepted || false,
  };
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ─── Hash Router helpers ───
  // Supported hashes: #/, #/login, #/register,
  //   #/feed, #/explore, #/bookmarks, #/notifications,
  //   #/messages, #/profile, #/profile/:userId,
  //   #/post/:postId, #/settings
  const parseHash = (hash = window.location.hash) => {
    const path = hash.replace(/^#\/?/, '') || '';
    const parts = path.split('/');
    const base = parts[0] || '';
    const param = parts[1] || null;
    // Map hash segments → view names used throughout the app
    const map = {
      '': 'landing', 'login': 'login', 'register': 'register',
      'feed': 'feed', 'explore': 'explore', 'bookmarks': 'bookmarks',
      'notifications': 'notifications', 'messages': 'messages',
      'profile': 'profile', 'post': 'post-detail', 'settings': 'settings',
    };
    return { view: map[base] || 'landing', param, base };
  };

  const buildHash = (v, data = {}) => {
    const viewToHash = {
      landing: '/', login: '/login', register: '/register',
      feed: '/feed', explore: '/explore', bookmarks: '/bookmarks',
      notifications: '/notifications', messages: '/messages',
      profile: '/profile', 'post-detail': '/post', settings: '/settings',
    };
    let h = viewToHash[v] || '/feed';
    if (v === 'profile' && data.userId) h = `/profile/${data.userId}`;
    if (v === 'post-detail' && data.postId) h = `/post/${data.postId}`;
    return `#${h}`;
  };

  // Derive initial view from the current hash (before React paints)
  const [view, setView]         = useState(() => parseHash().view);
  const [prevView, setPrevView] = useState(null);
  const [user, setUser]         = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Theme support
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('kovo_dark_mode') === 'true';
  });

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('kovo_dark_mode', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  const [feedTab, setFeedTab]           = useState('foryou');
  const [registerStep, setRegisterStep] = useState(1);
  const [registerData, setRegisterData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dob: '',
    country: '', city: '', profession: '',
    userType: 'student', acceptTerms: false,
  });
  const [formErrors, setFormErrors] = useState({});

  const [posts, setPosts]               = useState([]);
  const [comments, setComments]         = useState({});
  const [likedPosts, setLikedPosts]     = useState(() => loadSetFromStorage(STORAGE_KEYS.LIKED_POSTS));
  const [bookmarkedPosts, setBookmarkedPosts] = useState(() => loadSetFromStorage(STORAGE_KEYS.BOOKMARKED_POSTS));
  // Persisted per-post like counts (delta from backend)
  const postLikesRef = useRef(loadMapFromStorage(STORAGE_KEYS.POST_LIKES));
  // helpfulVotes: Map<id, { helpful: Set, notHelpful: Set }> for posts & comments
  const [helpfulVotes, setHelpfulVotes] = useState({});
  const [helpfulComments, setHelpfulComments] = useState(new Set());
  const [reportedContent, setReportedContent] = useState(new Set());

  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedPostId, setSelectedPostId]       = useState(null);
  const [selectedThreadId, setSelectedThreadId]   = useState(null);

  // DM conversations: { id, participantId, participantUser, messages: [{id, senderId, text, ts}], unread }
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDmUserId, setActiveDmUserId] = useState(null);

  // Connection states
  const [connectionsList, setConnectionsList] = useState([]);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [connectionCounts, setConnectionCounts] = useState({});

  const [messages]         = useState([]);
  const [notifications, setNotifications]   = useState([]);

  const [loading, setLoading] = useState({
    feed: false, post: false, createPost: false, login: false, register: false,
  });

  const [createPostData, setCreatePostData] = useState({ content: '', tags: [], files: [] });
  const [commentInputs, setCommentInputs]   = useState({});
  const [profileViewUserId, setProfileViewUserId] = useState(null);
  const [modal, setModal]   = useState(null);
  const [toasts, setToasts] = useState([]);

  const [feedCursor, setFeedCursor]   = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);

  // ─── Toasts ───
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4000);
  }, []);

  // ─── Navigation (hash-based) ───
  const navigate = useCallback((v, data = {}) => {
    setPrevView(view);
    // Write the new hash — the hashchange listener below will sync state
    const newHash = buildHash(v, data);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    } else {
      // Same hash (e.g. navigating to /feed while already there) — still sync state
      setView(v);
      if (data.postId !== undefined) setSelectedPostId(data.postId);
      if (data.userId !== undefined) setProfileViewUserId(data.userId);
      if (data.threadId !== undefined) setSelectedThreadId(data.threadId);
    }
    window.scrollTo(0, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ─── Hash-change listener — syncs URL → React state ───
  useEffect(() => {
    const APP_VIEWS = new Set(['feed','explore','bookmarks','notifications','messages','profile','post-detail','settings']);
    const AUTH_VIEWS = new Set(['landing','login','register']);

    const onHashChange = () => {
      const { view: v, param } = parseHash();

      // Guard: if logged in and trying to go to auth views → stay on feed
      if (isLoggedIn && AUTH_VIEWS.has(v)) {
        window.location.hash = '#/feed';
        return;
      }
      // Guard: if not logged in and trying app views → go to login
      if (!isLoggedIn && APP_VIEWS.has(v)) {
        window.location.hash = '#/login';
        return;
      }

      setPrevView(prev => prev);
      setView(v);

      // Restore deep-link params from URL
      if (v === 'post-detail' && param) setSelectedPostId(param);
      else setSelectedPostId(null);

      if (v === 'profile' && param) setProfileViewUserId(param);
      else if (v !== 'profile') setProfileViewUserId(null);

      setSelectedThreadId(null);
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', onHashChange);
    // Trigger once immediately to handle the initial hash on mount
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // ─── Modal ───
  const openModal = useCallback((type, props = {}) => {
    setModal({ type, props });
    document.body.style.overflow = 'hidden';
  }, []);
  const closeModal = useCallback(() => {
    setModal(null);
    document.body.style.overflow = '';
  }, []);

  // ─── Feed ───
  const loadFeed = useCallback(async (cursor = null) => {
    setLoading(prev => ({ ...prev, feed: true }));
    try {
      const res = await postsApi.getFeed(cursor);
      const savedLikes = postLikesRef.current;
      const normalised = (res.data || []).map(p => {
        const post = normalisePost(p);
        // Restore persisted like count if available
        if (savedLikes[post.id] !== undefined) {
          post.likes = savedLikes[post.id];
        }
        return post;
      });
      if (cursor) {
        setPosts(prev => [...prev, ...normalised]);
      } else {
        setPosts(normalised);
      }
      setFeedCursor(res.pagination?.nextCursor || null);
      setFeedHasMore(res.pagination?.hasMore || false);
    } catch (err) {
      showToast('Could not load feed. ' + (err.message || ''), 'error');
    } finally {
      setLoading(prev => ({ ...prev, feed: false }));
    }
  }, [showToast]);

  // ─── Load notifications ───
  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifications((res.data || []).map(normaliseNotification));
    } catch { /* silent */ }
  }, []);

  // ─── Restore session on mount ───
  useEffect(() => {
    const token = tokenStorage.getAccess();
    const { view: initialView, param } = parseHash();
    const APP_VIEWS  = new Set(['feed','explore','bookmarks','notifications','messages','profile','post-detail','settings']);
    const AUTH_VIEWS = new Set(['landing','login','register']);

    if (!token) {
      // No token — if user is trying to access an app page, send to login
      if (APP_VIEWS.has(initialView)) window.location.hash = '#/login';
      // Otherwise (on landing/login/register) leave them where they are
      return;
    }

    // Token exists — verify with backend and restore session
    authApi.me().then(({ id, email, profile }) => {
      const restoredUser = buildUser({ id, email }, profile);
      setUser(restoredUser);
      setIsLoggedIn(true);

      // Determine where to land:
      // If they refreshed on an app view → stay there
      // If they are on an auth view → redirect to feed (or their remembered view)
      let landingView = initialView;
      let landingParam = param;

      if (AUTH_VIEWS.has(initialView)) {
        // Coming from auth page with a valid token → always go to feed
        landingView = 'feed';
        landingParam = null;
        window.location.hash = '#/feed';
      } else {
        // Stay on the current app view — update React state to match URL
        setView(landingView);
        if (landingView === 'post-detail' && landingParam) setSelectedPostId(landingParam);
        if (landingView === 'profile' && landingParam) setProfileViewUserId(landingParam);
      }

      setView(landingView);
      if (landingView === 'post-detail' && landingParam) setSelectedPostId(landingParam);
      if (landingView === 'profile' && landingParam) setProfileViewUserId(landingParam);

      loadFeed();
      loadNotifications();
    }).catch(() => {
      // Token invalid — clear and redirect to login only if on an app view
      tokenStorage.clear();
      if (APP_VIEWS.has(initialView)) {
        window.location.hash = '#/login';
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load comments for a post ───
  const loadComments = useCallback(async (postId) => {
    if (comments[postId]) return;
    try {
      const res = await commentsApi.getComments(postId);
      const normalised = (res.data || []).map(c => normaliseComment(c, postId));
      setComments(prev => ({ ...prev, [postId]: normalised }));
    } catch {
      setComments(prev => ({ ...prev, [postId]: [] }));
    }
  }, [comments]);

  // ─── Auth: login ───
  const login = useCallback(async (email, password, cb) => {
    setLoading(prev => ({ ...prev, login: true }));
    try {
      await authApi.login(email, password);
      const { id, email: userEmail, profile } = await authApi.me();
      const fullUser = buildUser({ id, email: userEmail }, profile);
      setUser(fullUser);
      setIsLoggedIn(true);
      window.location.hash = '#/feed';  // triggers hashchange → setView('feed')
      loadFeed();
      loadNotifications();
      cb?.();
    } catch (err) {
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, login: false }));
    }
  }, [loadFeed, loadNotifications]);

  // ─── Auth: register ───
  const register = useCallback(async (formData, cb) => {
    setLoading(prev => ({ ...prev, register: true }));
    try {
      await authApi.register(formData.email, formData.password);
      await authApi.onboard(formData);
      await authApi.acceptTos();
      const { id, email, profile } = await authApi.me();
      const fullUser = buildUser({ id, email }, profile);
      setUser(fullUser);
      setIsLoggedIn(true);
      window.location.hash = '#/feed';  // triggers hashchange → setView('feed')
      loadFeed();
      loadNotifications();
      cb?.();
    } catch (err) {
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, register: false }));
    }
  }, [loadFeed, loadNotifications]);



  // ─── Auth: logout ───
  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setIsLoggedIn(false);
    setPosts([]);
    setComments({});
    setNotifications([]);
    setLikedPosts(new Set());
    setBookmarkedPosts(new Set());
    postLikesRef.current = {};
    // Clear persisted interaction data
    try {
      localStorage.removeItem(STORAGE_KEYS.LIKED_POSTS);
      localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_POSTS);
      localStorage.removeItem(STORAGE_KEYS.POST_LIKES);
    } catch { /* ignore */ }
    window.location.hash = '#/';  // back to landing, hashchange listener sets view
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await usersApi.deleteAccount();
      setUser(null);
      setIsLoggedIn(false);
      setPosts([]);
      setComments({});
      setNotifications([]);
      setLikedPosts(new Set());
      setBookmarkedPosts(new Set());
      postLikesRef.current = {};
      try {
        localStorage.removeItem(STORAGE_KEYS.LIKED_POSTS);
        localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_POSTS);
        localStorage.removeItem(STORAGE_KEYS.POST_LIKES);
      } catch { /* ignore */ }
      window.location.hash = '#/';
      showToast('Account deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete account.', 'error');
    }
  }, [showToast]);

  const uploadFileToCloudinary = useCallback(async (rawFile, name) => {
    let mimeType = rawFile.type;
    const fileSize = rawFile.size;
    
    // Fix MIME type for iPhone HEIC/HEIF
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = name.split('.').pop().toLowerCase();
      const extToMime = {
        'heic': 'image/heic', 'heif': 'image/heif',
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'gif': 'image/gif', 'webp': 'image/webp', 'pdf': 'application/pdf',
      };
      if (extToMime[ext]) mimeType = extToMime[ext];
    }
    
    const presignRes = await api.get(`/uploads/presign?mime_type=${encodeURIComponent(mimeType)}&file_size=${fileSize}`);
    const { signature, timestamp, apiKey, uploadPreset, uploadUrl } = presignRes.data;
    
    const formData = new FormData();
    formData.append('file', rawFile);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    if (uploadPreset) {
      formData.append('upload_preset', uploadPreset);
    }
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadRes.ok) {
      throw new Error(`Cloudinary upload failed for file "${name}"`);
    }
    
    const uploadData = await uploadRes.json();
    return {
      name,
      url: uploadData.secure_url,
      mime_type: mimeType,
      size_bytes: fileSize
    };
  }, []);

  const submitPost = useCallback(async (content, tags, files) => {
    setLoading(prev => ({ ...prev, createPost: true }));
    try {
      const attachments = [];
      
      // Upload files to Cloudinary using backend presigned URLs
      for (const file of (files || [])) {
        if (!file.rawFile) continue;
        const attachment = await uploadFileToCloudinary(file.rawFile, file.name);
        attachments.push(attachment);
      }

      const created = await postsApi.createPost({
        title: content.split('\n')[0].slice(0, 120) || 'Untitled',
        body: content,
        tags: tags.map(t => ({ type: 'topic', value: t })),
        attachments,
      });
      const newPost = normalisePost({ ...created, isTarget: true });
      setPosts(prev => [newPost, ...prev]);
      setComments(prev => ({ ...prev, [newPost.id]: [] }));
      setCreatePostData({ content: '', tags: [], files: [] });
      showToast('Post created successfully!', 'success');
    } catch (err) {
      showToast('Failed to create post: ' + (err.message || ''), 'error');
    } finally {
      setLoading(prev => ({ ...prev, createPost: false }));
    }
  }, [showToast]);

  const deletePost = useCallback(async (postId) => {
    try {
      await postsApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showToast('Post deleted.', 'info');
    } catch (err) {
      showToast('Failed to delete post: ' + (err.message || ''), 'error');
    }
  }, [showToast]);

  // ─── Comments ───
  const addComment = useCallback(async (postId, content) => {
    try {
      const created = await commentsApi.addComment(postId, content);
      const newComment = normaliseComment({ ...created, user_id: user?.id }, postId);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
    } catch (err) {
      showToast('Failed to post comment: ' + (err.message || ''), 'error');
      throw err;
    }
  }, [user, showToast]);

  // ─── Interactions (local optimistic updates + persisted) ───
  const toggleLike = useCallback((postId) => {
    const isCurrentlyLiked = likedPosts.has(postId);
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      saveSetToStorage(STORAGE_KEYS.LIKED_POSTS, next);
      return next;
    });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const newLikes = Math.max(0, p.likes + (isCurrentlyLiked ? -1 : 1));
      // Persist the like count
      postLikesRef.current[postId] = newLikes;
      saveMapToStorage(STORAGE_KEYS.POST_LIKES, postLikesRef.current);
      return { ...p, likes: newLikes };
    }));
  }, [likedPosts]);

  const toggleBookmark = useCallback((postId) => {
    const next = new Set(bookmarkedPosts);
    if (next.has(postId)) {
      next.delete(postId);
      showToast('Post removed from bookmarks.', 'info');
    } else {
      next.add(postId);
      showToast('Post bookmarked!', 'success');
    }
    saveSetToStorage(STORAGE_KEYS.BOOKMARKED_POSTS, next);
    setBookmarkedPosts(next);
  }, [bookmarkedPosts, showToast]);

  const toggleHelpful = useCallback((commentId) => {
    setHelpfulComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId); else next.add(commentId);
      return next;
    });
  }, []);

  // ─── Helpful / Not-Helpful votes (posts & comments) ───
  const voteHelpful = useCallback((contentId, vote) => {
    // vote: 'helpful' | 'not' | null (toggle off)
    setHelpfulVotes(prev => {
      const entry = prev[contentId] || { helpful: new Set(), not: new Set() };
      const helpful = new Set(entry.helpful);
      const not = new Set(entry.not);
      if (vote === 'helpful') {
        if (helpful.has('me')) { helpful.delete('me'); } else { helpful.add('me'); not.delete('me'); }
      } else if (vote === 'not') {
        if (not.has('me')) { not.delete('me'); } else { not.add('me'); helpful.delete('me'); }
      }
      return { ...prev, [contentId]: { helpful, not } };
    });
  }, []);

  const getVoteCounts = useCallback((contentId) => {
    const entry = helpfulVotes[contentId];
    if (!entry) return { helpfulCount: 0, notCount: 0, myVote: null };
    return {
      helpfulCount: entry.helpful.size,
      notCount: entry.not.size,
      myVote: entry.helpful.has('me') ? 'helpful' : entry.not.has('me') ? 'not' : null,
    };
  }, [helpfulVotes]);

  // ─── Connections (Friend Requests & Mutual Connections) ───
  const loadConnectionsList = useCallback(async () => {
    try {
      const res = await connectionsApi.getList();
      setConnectionsList(res.data || []);
    } catch (err) {
      console.error('Failed to load connections list:', err);
    }
  }, []);

  const loadPendingConnections = useCallback(async () => {
    try {
      const res = await connectionsApi.getPending();
      setPendingConnections(res.data || []);
    } catch (err) {
      console.error('Failed to load pending connections:', err);
    }
  }, []);

  const fetchConnectionCount = useCallback(async (targetUserId) => {
    try {
      const res = await connectionsApi.getCount(targetUserId);
      const count = res.data?.count || 0;
      setConnectionCounts(prev => ({ ...prev, [targetUserId]: count }));
      return count;
    } catch (err) {
      console.error('Failed to fetch connection count:', err);
      return 0;
    }
  }, []);

  const sendConnectionRequest = useCallback(async (targetUserId) => {
    try {
      const result = await connectionsApi.sendRequest(targetUserId);
      showToast('Connection request sent!', 'success');
      await loadConnectionsList();
      await loadPendingConnections();
      await fetchConnectionCount(targetUserId);
      return result;
    } catch (err) {
      showToast(err.message || 'Failed to send request', 'error');
      throw err;
    }
  }, [showToast, loadConnectionsList, loadPendingConnections, fetchConnectionCount]);

  const respondToConnection = useCallback(async (connectionId, action) => {
    try {
      await connectionsApi.respondRequest(connectionId, action);
      showToast(action === 'accept' ? 'Connection request accepted!' : 'Connection request declined.', 'info');
      await loadConnectionsList();
      await loadPendingConnections();
    } catch (err) {
      showToast(err.message || 'Failed to respond to request', 'error');
    }
  }, [showToast, loadConnectionsList, loadPendingConnections]);

  const withdrawConnectionRequest = useCallback(async (connectionId) => {
    try {
      await connectionsApi.withdrawRequest(connectionId);
      showToast('Connection request withdrawn.', 'info');
      await loadConnectionsList();
      await loadPendingConnections();
    } catch (err) {
      showToast(err.message || 'Failed to withdraw request', 'error');
    }
  }, [showToast, loadConnectionsList, loadPendingConnections]);

  // ─── DM Conversations ───
  const loadConversations = useCallback(async () => {
    try {
      const list = await messagesApi.getConversations();
      const formatted = list.map(c => ({
        id: `dm-${c.partner.id}`,
        participantId: c.partner.id,
        participantUser: {
          id: c.partner.id,
          username: `${c.partner.first_name || ''} ${c.partner.last_name || ''}`.trim() || 'User',
          firstName: c.partner.first_name,
          lastName: c.partner.last_name,
          avatar_url: c.partner.avatar_url,
        },
        messages: c.lastMessage ? [{
          id: `last-${c.partner.id}`,
          senderId: c.lastMessage.isMine ? 'me' : c.partner.id,
          text: c.lastMessage.body,
          ts: new Date(c.lastMessage.created_at).getTime()
        }] : [],
        unread: 0,
      }));
      setDmConversations(formatted);
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, []);

  const loadActiveMessages = useCallback(async (partnerId) => {
    if (!partnerId) return;
    try {
      const res = await messagesApi.getConversationMessages(partnerId);
      const formattedMsgs = res.data.map(m => ({
        id: m.id,
        senderId: m.sender_id === user?.id ? 'me' : m.sender_id,
        text: m.body,
        postId: m.post_id || null,
        ts: new Date(m.created_at).getTime()
      }));

      setDmConversations(prev => {
        const exists = prev.find(c => c.participantId === partnerId);
        if (exists) {
          return prev.map(c => {
            if (c.participantId !== partnerId) return c;
            return { ...c, messages: formattedMsgs };
          });
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load messages for conversation', err);
    }
  }, [user]);

  useEffect(() => {
    if (isLoggedIn) {
      loadConversations();
      loadConnectionsList();
      loadPendingConnections();
    }
  }, [isLoggedIn, loadConversations, loadConnectionsList, loadPendingConnections]);

  useEffect(() => {
    if (isLoggedIn && view === 'notifications') {
      loadNotifications();
      loadPendingConnections();
      loadConnectionsList();
    }
  }, [isLoggedIn, view, loadNotifications, loadPendingConnections, loadConnectionsList]);

  useEffect(() => {
    if (isLoggedIn && activeDmUserId) {
      loadActiveMessages(activeDmUserId);
    }
  }, [isLoggedIn, activeDmUserId, loadActiveMessages]);

  const startDm = useCallback((targetUser) => {
    setDmConversations(prev => {
      const exists = prev.find(c => c.participantId === targetUser.id);
      if (!exists) {
        return [...prev, {
          id: `dm-${targetUser.id}`,
          participantId: targetUser.id,
          participantUser: targetUser,
          messages: [],
          unread: 0,
          createdAt: Date.now(),
        }];
      }
      return prev;
    });
    setActiveDmUserId(targetUser.id);
    window.location.hash = '#/messages';
    window.scrollTo(0, 0);
  }, []);

  const sendDm = useCallback(async (participantId, text, postId = null) => {
    if (!text.trim()) return;
    try {
      const newMsg = await messagesApi.sendMessage(participantId, text.trim(), postId);
      const formattedMsg = {
        id: newMsg.id,
        senderId: 'me',
        text: newMsg.body,
        postId: newMsg.post_id || postId,
        ts: new Date(newMsg.created_at).getTime()
      };
      
      setDmConversations(prev => {
        const exists = prev.find(c => c.participantId === participantId);
        if (exists) {
          return prev.map(c => {
            if (c.participantId !== participantId) return c;
            return {
              ...c,
              messages: [...c.messages, formattedMsg]
            };
          });
        } else {
          loadConversations();
          return prev;
        }
      });
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    }
  }, [loadConversations, showToast]);

  const reportContent = useCallback((id) => {
    setReportedContent(prev => new Set([...prev, id]));
  }, []);

  // ─── Notifications ───
  const markAllRead = useCallback(async () => {
    try { await notificationsApi.markAllRead(); } catch { /* best effort */ }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // ─── User profile update ───
  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);



  // ─── Context value ───
  const value = {
    view, navigate, prevView,
    user, setUser, updateUser, isLoggedIn, setIsLoggedIn,
    darkMode, toggleDarkMode,
    feedTab, setFeedTab,
    registerStep, setRegisterStep,
    registerData, setRegisterData,
    formErrors, setFormErrors,
    posts, setPosts, deletePost, submitPost,
    comments, setComments, addComment, loadComments,
    likedPosts, toggleLike,
    bookmarkedPosts, toggleBookmark,
    helpfulComments, toggleHelpful,
    helpfulVotes, voteHelpful, getVoteCounts,
    reportedContent, reportContent,
    searchQuery, setSearchQuery,
    selectedPostId, selectedThreadId, setSelectedThreadId,
    messages,
    dmConversations, activeDmUserId, setActiveDmUserId, startDm, sendDm,
    connectionsList, setConnectionsList, pendingConnections, setPendingConnections, connectionCounts,
    loadConnectionsList, loadPendingConnections, sendConnectionRequest, respondToConnection, withdrawConnectionRequest, fetchConnectionCount,
    notifications, setNotifications, markAllRead, loadNotifications,
    loading, setLoading,
    createPostData, setCreatePostData, uploadFileToCloudinary,
    commentInputs, setCommentInputs,
    profileViewUserId,
    modal, openModal, closeModal,
    toasts, showToast,
    login, logout, register, deleteAccount,
    feedCursor, feedHasMore, loadFeed,
    sampleUsers: [],
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
