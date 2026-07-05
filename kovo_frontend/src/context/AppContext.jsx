import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { authApi } from '../api/auth.js';
import { postsApi, commentsApi } from '../api/posts.js';
import { messagesApi } from '../api/messages.js';
import { notificationsApi, usersApi } from '../api/users.js';
import { connectionsApi } from '../api/connections.js';
import { tokenStorage, api } from '../api/client.js';
import { ledgerApi } from '../api/ledger.js';
import { supabase } from '../api/supabase.js';
import { chatStorage } from '../utils/chatStorage.js';

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

// ─── Helper: normalise a backend post ───
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
    read: n.is_read !== undefined ? n.is_read : (n.read || false),
    postId: n.post_id || n.postId || null,
    referenceType: n.reference_type || null,
    referenceId: n.reference_id || null,
    createdAt: n.created_at ? new Date(n.created_at).getTime() : (n.createdAt || Date.now()),
  };
}

// ─── Helper: build a user object ───
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

// Helper for parsing hash routes
const parseHash = (hash = window.location.hash) => {
  const path = hash.replace(/^#\/?/, '') || '';
  const parts = path.split('/');
  const base = parts[0] || '';
  const param = parts[1] || null;
  const map = {
    '': 'landing', 'login': 'login', 'register': 'register',
    'feed': 'feed', 'explore': 'explore', 'bookmarks': 'bookmarks',
    'notifications': 'notifications', 'messages': 'messages',
    'profile': 'profile', 'post': 'post-detail', 'settings': 'settings',
    'feedback': 'feedback', 'connections': 'connections',
  };
  return { view: map[base] || 'landing', param, base };
};

const buildHash = (v, data = {}) => {
  const viewToHash = {
    landing: '/', login: '/login', register: '/register',
    feed: '/feed', explore: '/explore', bookmarks: '/bookmarks',
    notifications: '/notifications', messages: '/messages',
    profile: '/profile', 'post-detail': '/post', settings: '/settings',
    feedback: '/feedback', connections: '/connections',
  };
  let h = viewToHash[v] || '/feed';
  if (v === 'profile' && data.userId) h = `/profile/${data.userId}`;
  if (v === 'post-detail' && data.postId) h = `/post/${data.postId}`;
  if (v === 'connections' && data.tab) h = `/connections/${data.tab}`;
  return `#${h}`;
};

// ─── Context declarations ───
const ThemeContext = createContext(null);
const UIContext = createContext(null);
const AuthContext = createContext(null);
const NavigationContext = createContext(null);
const SearchContext = createContext(null);
const PostsContext = createContext(null);
const ConnectionsContext = createContext(null);
const DmContext = createContext(null);
const NotificationContext = createContext(null);

// ─── Theme Provider ───
export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('kovo_dark_mode') === 'true'; } catch { return false; }
  });

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      try { localStorage.setItem('kovo_dark_mode', String(next)); } catch { /* ignore */ }
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const value = useMemo(() => ({ darkMode, toggleDarkMode }), [darkMode, toggleDarkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── UI Provider (Modals, Toasts, Uploads) ───
export function UIProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);

  const openModal = useCallback((type, props = {}) => {
    setModal({ type, props });
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    document.body.style.overflow = '';
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    
    setToasts(prev => {
      const active = prev.filter(t => !t.exiting);
      if (active.length >= 2) {
        const oldestId = active[0].id;
        setTimeout(() => {
          setToasts(current => current.filter(t => t.id !== oldestId));
        }, 300);
        return prev.map(t => t.id === oldestId ? { ...t, exiting: true } : t)
          .concat({ id, message, type, exiting: false });
      }
      return [...prev, { id, message, type, exiting: false }];
    });

    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4000);
  }, []);

  const uploadFileToCloudinary = useCallback(async (rawFile, name) => {
    let mimeType = rawFile.type;
    const fileSize = rawFile.size;
    
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

  const value = useMemo(() => ({
    modal, openModal, closeModal, toasts, showToast, uploadFileToCloudinary
  }), [modal, openModal, closeModal, toasts, showToast, uploadFileToCloudinary]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// ─── Auth Provider ───
export function AuthProvider({ children }) {
  const { showToast } = useUI();

  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [registerStep, setRegisterStep] = useState(1);
  const [registerData, setRegisterData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dob: '',
    country: '', city: '', profession: '',
    userType: 'student', acceptTerms: false,
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState({ login: false, register: false });

  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  const login = useCallback(async (email, password, cb) => {
    setLoading(prev => ({ ...prev, login: true }));
    try {
      await authApi.login(email, password);
      const { id, email: userEmail, profile } = await authApi.me();
      const fullUser = buildUser({ id, email: userEmail }, profile);
      setUser(fullUser);
      setIsLoggedIn(true);
      window.location.hash = '#/feed';
      cb?.();
    } catch (err) {
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, login: false }));
    }
  }, []);

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
      window.location.hash = '#/feed';
      cb?.();
    } catch (err) {
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, register: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setIsLoggedIn(false);
    try {
      localStorage.removeItem(STORAGE_KEYS.LIKED_POSTS);
      localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_POSTS);
      localStorage.removeItem(STORAGE_KEYS.POST_LIKES);
      chatStorage.clear();
    } catch { /* ignore */ }
    window.location.hash = '#/';
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await usersApi.deleteAccount();
      setUser(null);
      setIsLoggedIn(false);
      try {
        localStorage.removeItem(STORAGE_KEYS.LIKED_POSTS);
        localStorage.removeItem(STORAGE_KEYS.BOOKMARKED_POSTS);
        localStorage.removeItem(STORAGE_KEYS.POST_LIKES);
        chatStorage.clear();
      } catch { /* ignore */ }
      window.location.hash = '#/';
      showToast('Account deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete account.', 'error');
    }
  }, [showToast]);

  // Restore session on mount
  useEffect(() => {
    const token = tokenStorage.getAccess();
    const { view: initialView, param } = parseHash();
    const APP_VIEWS = new Set(['feed','explore','bookmarks','notifications','messages','profile','post-detail','settings','feedback','connections']);
    const AUTH_VIEWS = new Set(['landing','login','register']);

    if (!token) {
      if (APP_VIEWS.has(initialView)) window.location.hash = '#/login';
      setSessionRestoring(false);
      return;
    }

    authApi.me().then(({ id, email, profile }) => {
      const restoredUser = buildUser({ id, email }, profile);
      setUser(restoredUser);
      setIsLoggedIn(true);

      if (AUTH_VIEWS.has(initialView)) {
        window.location.hash = '#/feed';
      }
    }).catch(() => {
      tokenStorage.clear();
      if (APP_VIEWS.has(initialView)) {
        window.location.hash = '#/login';
      }
    }).finally(() => {
      setSessionRestoring(false);
    });
  }, []);

  const value = useMemo(() => ({
    user, setUser, updateUser, isLoggedIn, setIsLoggedIn, sessionRestoring,
    registerStep, setRegisterStep, registerData, setRegisterData,
    formErrors, setFormErrors, loading, login, register, logout, deleteAccount
  }), [user, isLoggedIn, sessionRestoring, registerStep, registerData, formErrors, loading, login, register, logout, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Navigation Provider ───
export function NavigationProvider({ children }) {
  const { isLoggedIn, sessionRestoring } = useAuth();

  const [view, setView] = useState(() => parseHash().view);
  const [navigationParam, setNavigationParam] = useState(() => parseHash().param);
  const [profileViewUserId, setProfileViewUserId] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);

  const navigate = useCallback((v, data = {}) => {
    const newHash = buildHash(v, data);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    } else {
      setView(v);
      if (data.postId !== undefined) setSelectedPostId(data.postId);
      if (data.userId !== undefined) setProfileViewUserId(data.userId);
      if (data.tab !== undefined) setNavigationParam(data.tab);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const APP_VIEWS = new Set(['feed','explore','bookmarks','notifications','messages','profile','post-detail','settings','feedback','connections']);
    const AUTH_VIEWS = new Set(['landing','login','register']);

    const onHashChange = () => {
      const { view: v, param } = parseHash();

      if (isLoggedIn && AUTH_VIEWS.has(v)) {
        window.location.hash = '#/feed';
        return;
      }
      if (!isLoggedIn && APP_VIEWS.has(v)) {
        if (sessionRestoring) return;
        window.location.hash = '#/login';
        return;
      }

      setView(v);
      setNavigationParam(param);

      if (v === 'post-detail' && param) setSelectedPostId(param);
      else setSelectedPostId(null);

      if (v === 'profile' && param) setProfileViewUserId(param);
      else if (v !== 'profile') setProfileViewUserId(null);

      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isLoggedIn, sessionRestoring]);

  const value = useMemo(() => ({
    view, setView, profileViewUserId, setProfileViewUserId, selectedPostId, setSelectedPostId, navigationParam, setNavigationParam, navigate
  }), [view, profileViewUserId, selectedPostId, navigationParam, navigate]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

// ─── Search Provider ───
export function SearchProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState([]);

  useEffect(() => {
    if (!isLoggedIn || !searchQuery.trim()) {
      setSearchedUsers([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await usersApi.searchUsers(searchQuery);
        setSearchedUsers(res.data || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, isLoggedIn]);



  const value = useMemo(() => ({
    searchQuery, setSearchQuery, searchedUsers
  }), [searchQuery, searchedUsers]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// ─── Posts Provider ───
export function PostsProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const { showToast, uploadFileToCloudinary } = useUI();

  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [likedPosts, setLikedPosts] = useState(() => loadSetFromStorage(STORAGE_KEYS.LIKED_POSTS));
  const [bookmarkedPosts, setBookmarkedPosts] = useState(() => loadSetFromStorage(STORAGE_KEYS.BOOKMARKED_POSTS));
  
  const postLikesRef = useRef(loadMapFromStorage(STORAGE_KEYS.POST_LIKES));
  const [helpfulVotes, setHelpfulVotes] = useState({});
  const [helpfulComments, setHelpfulComments] = useState(new Set());
  const [reportedContent, setReportedContent] = useState(new Set());
  
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedTab, setFeedTab] = useState('foryou');
  const [createPostData, setCreatePostData] = useState({ content: '', tags: [], files: [] });
  const [commentInputs, setCommentInputs] = useState({});

  const [loading, setLoading] = useState({ feed: false, post: false, createPost: false });

  // Clear posts state on logout
  useEffect(() => {
    if (!isLoggedIn) {
      setPosts([]);
      setComments({});
      setLikedPosts(new Set());
      setBookmarkedPosts(new Set());
      postLikesRef.current = {};
      setHelpfulVotes({});
      setHelpfulComments(new Set());
      setReportedContent(new Set());
    }
  }, [isLoggedIn]);

  const loadFeed = useCallback(async (cursor = null, silent = false) => {
    if (!silent) setLoading(prev => ({ ...prev, feed: true }));
    try {
      const res = await postsApi.getFeed(cursor);
      const savedLikes = postLikesRef.current;
      const normalised = (res.data || []).map(p => {
        const post = normalisePost(p);
        if (savedLikes[post.id] !== undefined) {
          post.likes = savedLikes[post.id];
        }
        return post;
      });
      if (cursor) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = normalised.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      } else {
        if (silent) {
          setPosts(prev => {
            const updated = prev.map(p => {
              const latest = normalised.find(n => n.id === p.id);
              return latest ? { ...p, ...latest, likes: p.likes } : p;
            });
            const existingIds = new Set(prev.map(p => p.id));
            const brandNew = normalised.filter(p => !existingIds.has(p.id));
            return [...brandNew, ...updated];
          });
        } else {
          setPosts(normalised);
        }
      }
      setFeedCursor(res.pagination?.nextCursor || null);
      setFeedHasMore(res.pagination?.hasMore || false);
    } catch (err) {
      if (!silent) showToast('Could not load feed. ' + (err.message || ''), 'error');
    } finally {
      if (!silent) setLoading(prev => ({ ...prev, feed: false }));
    }
  }, [showToast]);

  const navigation = useContext(NavigationContext);
  const view = navigation?.view || 'feed';

  // Initial feed load on login
  useEffect(() => {
    if (isLoggedIn) {
      loadFeed();
    }
  }, [isLoggedIn, loadFeed]);

  // Background silent poll — refresh feed every 60s without disturbing user
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      loadFeed(null, true); // silent=true: merges new posts without resetting scroll
    }, 60_000);
    return () => clearInterval(interval);
  }, [isLoggedIn, loadFeed]);

  // Real-time WebSocket new post and comment reaction listener
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const handleWsPost = (e) => {
      const { post } = e.detail;
      const normalised = normalisePost(post);
      setPosts(prev => {
        if (prev.some(p => p.id === normalised.id)) return prev;
        return [normalised, ...prev];
      });
    };

    const handleWsReaction = (e) => {
      const { targetId, targetType, userId, action, emoji } = e.detail;
      if (targetType !== 'comment') return;

      setComments(prev => {
        let foundPostId = null;
        for (const [postId, commentList] of Object.entries(prev)) {
          if (commentList.some(c => c.id === targetId)) {
            foundPostId = postId;
            break;
          }
        }
        if (!foundPostId) return prev;

        const updatedComments = prev[foundPostId].map(c => {
          if (c.id !== targetId) return c;
          let updatedReactions = [...(c.reactions || [])];
          if (action === 'removed') {
            updatedReactions = updatedReactions.filter(r => !(r.userId === userId && r.emoji === emoji));
          } else if (action === 'updated') {
            updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
          } else if (action === 'added') {
            if (!updatedReactions.some(r => r.userId === userId)) {
              updatedReactions.push({ userId, emoji });
            } else {
              updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
            }
          }
          return { ...c, reactions: updatedReactions };
        });

        return { ...prev, [foundPostId]: updatedComments };
      });
    };

    window.addEventListener('ws-new-post', handleWsPost);
    window.addEventListener('ws-reaction-update', handleWsReaction);
    return () => {
      window.removeEventListener('ws-new-post', handleWsPost);
      window.removeEventListener('ws-reaction-update', handleWsReaction);
    };
  }, [isLoggedIn]);

  const loadComments = useCallback(async (postId) => {
    try {
      const res = await commentsApi.getComments(postId);
      const normalised = (res.data || []).map(c => normaliseComment(c, postId));
      setComments(prev => ({ ...prev, [postId]: normalised }));
    } catch {
      setComments(prev => ({ ...prev, [postId]: [] }));
    }
  }, []);

  const submitPost = useCallback(async (content, tags, files) => {
    setLoading(prev => ({ ...prev, createPost: true }));
    const tempId = `temp-post-${Date.now()}`;
    
    // Create and insert optimistic post card instantly
    const tempPost = {
      id: tempId,
      userId: user?.id,
      content: content,
      tags: tags,
      attachments: (files || []).map(f => ({ name: f.name, url: '', mime_type: f.type })),
      likes: 0,
      comments: 0,
      createdAt: Date.now(),
      creator: user ? {
        id: user.id,
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        avatar_url: user.avatar_url || null,
        profession: user.profession || '',
        department: user.department || '',
        country: user.country || '',
        points: user.points || 0,
        user_type: user.user_type || 'student'
      } : null,
      status: 'posting',
      isTarget: true
    };

    setPosts(prev => [tempPost, ...prev]);
    setCreatePostData({ content: '', tags: [], files: [] });

    try {
      // Step 1: Upload attachments in parallel
      const uploadPromises = (files || [])
        .filter(file => file.rawFile)
        .map(file => uploadFileToCloudinary(file.rawFile, file.name));
      const attachments = await Promise.all(uploadPromises);

      // Step 2: Create post on backend
      const created = await postsApi.createPost({
        title: content.split('\n')[0].slice(0, 120) || 'Untitled',
        body: content,
        tags: tags.map(t => ({ type: 'topic', value: t })),
        attachments,
      });

      const newPost = normalisePost({ ...created, isTarget: true });

      // Step 3: Replace the optimistic stub with the real post
      setPosts(prev => prev.map(p => p.id === tempId ? newPost : p));
      setComments(prev => ({ ...prev, [newPost.id]: [] }));
      showToast('Post created successfully!', 'success');
    } catch (err) {
      // Rollback optimistic update on error
      setPosts(prev => prev.filter(p => p.id !== tempId));
      showToast('Failed to create post: ' + (err.message || ''), 'error');
    } finally {
      setLoading(prev => ({ ...prev, createPost: false }));
    }
  }, [showToast, uploadFileToCloudinary, user]);

  const deletePost = useCallback(async (postId) => {
    try {
      await postsApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showToast('Post deleted.', 'info');
    } catch (err) {
      showToast('Failed to delete post: ' + (err.message || ''), 'error');
    }
  }, [showToast]);

  const addComment = useCallback(async (postId, content) => {
    const tempId = `temp-comment-${Date.now()}`;
    const tempComment = {
      id: tempId,
      body: content,
      content: content,
      created_at: new Date().toISOString(),
      createdAt: Date.now(),
      commenter: user ? {
        id: user.id,
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        avatar_url: user.avatar_url || null
      } : null,
      status: 'posting',
      reactions: []
    };

    // Optimistically update comment list and comment count
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), tempComment] }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));

    try {
      const created = await commentsApi.addComment(postId, content);
      const newComment = normaliseComment({ ...created, user_id: user?.id }, postId);
      
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c => c.id === tempId ? newComment : c)
      }));
    } catch (err) {
      // Revert optimistic updates
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== tempId)
      }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 0) - 1) } : p));
      showToast('Failed to post comment: ' + (err.message || ''), 'error');
      throw err;
    }
  }, [user, showToast]);

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

  const toggleHelpful = useCallback(async (commentId) => {
    try {
      await ledgerApi.awardHelpfulPoints(commentId);
      setHelpfulComments(prev => {
        const next = new Set(prev);
        next.add(commentId);
        return next;
      });
      showToast('Comment marked as helpful! Points awarded.', 'success');
    } catch (err) {
      console.error('Failed to mark comment helpful:', err);
      showToast(err.message || 'Failed to mark comment helpful.', 'error');
    }
  }, [showToast]);

  const voteHelpful = useCallback((contentId, vote) => {
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

  const reportContent = useCallback((id) => {
    setReportedContent(prev => new Set([...prev, id]));
  }, []);

  const value = useMemo(() => ({
    posts, setPosts, comments, setComments, likedPosts, setLikedPosts, bookmarkedPosts, setBookmarkedPosts,
    helpfulVotes, setHelpfulVotes, helpfulComments, setHelpfulComments, reportedContent, setReportedContent,
    feedCursor, feedHasMore, feedTab, setFeedTab, createPostData, setCreatePostData, commentInputs, setCommentInputs,
    loading, loadFeed, loadComments, submitPost, deletePost, addComment, toggleLike, toggleBookmark, toggleHelpful,
    voteHelpful, getVoteCounts, reportContent
  }), [posts, comments, likedPosts, bookmarkedPosts, helpfulVotes, helpfulComments, reportedContent, feedCursor, feedHasMore, feedTab, createPostData, commentInputs, loading, loadFeed, loadComments, submitPost, deletePost, addComment, toggleLike, toggleBookmark, toggleHelpful, voteHelpful, getVoteCounts, reportContent]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

// ─── Connections Provider ───
export function ConnectionsProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const { showToast } = useUI();

  const [connectionsList, setConnectionsList] = useState([]);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [connectionCounts, setConnectionCounts] = useState({});

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
      // Update local context in the background without blocking the UI transition
      loadConnectionsList();
      loadPendingConnections();
      fetchConnectionCount(targetUserId);
      window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
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
      loadConnectionsList();
      loadPendingConnections();
      if (user?.id) {
        fetchConnectionCount(user.id);
      }
      window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
    } catch (err) {
      showToast(err.message || 'Failed to respond to request', 'error');
    }
  }, [showToast, loadConnectionsList, loadPendingConnections, fetchConnectionCount, user]);

  const withdrawConnectionRequest = useCallback(async (connectionId) => {
    try {
      await connectionsApi.withdrawRequest(connectionId);
      showToast('Connection request withdrawn.', 'info');
      loadConnectionsList();
      loadPendingConnections();
      window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
    } catch (err) {
      showToast(err.message || 'Failed to withdraw request', 'error');
    }
  }, [showToast, loadConnectionsList, loadPendingConnections]);

  const removeConnection = useCallback(async (connectionId) => {
    try {
      await connectionsApi.removeConnection(connectionId);
      showToast('Connection removed.', 'info');
      loadConnectionsList();
      loadPendingConnections();
      if (user?.id) {
        fetchConnectionCount(user.id);
      }
      window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
    } catch (err) {
      showToast(err.message || 'Failed to remove connection', 'error');
      throw err;
    }
  }, [showToast, loadConnectionsList, loadPendingConnections, fetchConnectionCount, user]);

  useEffect(() => {
    if (isLoggedIn) {
      loadConnectionsList();
      loadPendingConnections();
      if (user?.id) fetchConnectionCount(user.id);
    } else {
      setConnectionsList([]);
      setPendingConnections([]);
      setConnectionCounts({});
    }
  }, [isLoggedIn, loadConnectionsList, loadPendingConnections, fetchConnectionCount, user]);

  useEffect(() => {
    const handleRefresh = () => {
      loadConnectionsList();
      loadPendingConnections();
      if (user?.id) fetchConnectionCount(user.id);
    };
    window.addEventListener('connection-accepted-refresh', handleRefresh);
    return () => window.removeEventListener('connection-accepted-refresh', handleRefresh);
  }, [loadConnectionsList, loadPendingConnections, fetchConnectionCount, user]);

  const value = useMemo(() => ({
    connectionsList, setConnectionsList, pendingConnections, setPendingConnections, connectionCounts, setConnectionCounts,
    loadConnectionsList, loadPendingConnections, fetchConnectionCount, sendConnectionRequest, respondToConnection, withdrawConnectionRequest, removeConnection
  }), [connectionsList, pendingConnections, connectionCounts, loadConnectionsList, loadPendingConnections, fetchConnectionCount, sendConnectionRequest, respondToConnection, withdrawConnectionRequest, removeConnection]);

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

// ─── DM Provider ───
export function DmProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const { showToast } = useUI();
  const { connectionsList } = useConnections();

  const [dmConversations, setDmConversations] = useState([]);
  const [activeDmUserId, setActiveDmUserId] = useState(null);

  // Instantly load cached conversations on mount/login, and reset state on logout
  useEffect(() => {
    let active = true;
    async function initOfflineStore() {
      if (!isLoggedIn) {
        setDmConversations([]);
        setActiveDmUserId(null);
        return;
      }
      try {
        const cached = await chatStorage.loadConversations();
        if (active && cached && cached.length > 0) {
          setDmConversations(cached);
        }
      } catch (err) {
        console.warn('Failed to load cached conversations', err);
      }
    }
    initOfflineStore();
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

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
          id: c.lastMessage.id || `last-${c.partner.id}`,
          senderId: c.lastMessage.isMine ? 'me' : c.partner.id,
          text: c.lastMessage.body,
          ts: new Date(c.lastMessage.created_at).getTime(),
          status: 'sent'
        }] : [],
        unread: 0,
      }));

      setDmConversations(prev => {
        const next = formatted.map(freshConv => {
          const localConv = prev.find(c => c.participantId === freshConv.participantId);
          if (localConv && localConv.messages.length > 0) {
            return {
              ...freshConv,
              messages: localConv.messages,
              hasMore: localConv.hasMore,
              nextCursor: localConv.nextCursor
            };
          }
          return freshConv;
        });
        chatStorage.saveConversations(next);
        return next;
      });
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, []);

  const loadActiveMessages = useCallback(async (partnerId, cursor = null) => {
    if (!partnerId) return;

    // Stale-While-Revalidate: load immediately from IndexedDB cache
    if (!cursor) {
      try {
        const cached = await chatStorage.loadConversations();
        const match = cached.find(c => c.participantId === partnerId);
        if (match && match.messages && match.messages.length > 0) {
          setDmConversations(prev => {
            const exists = prev.find(c => c.participantId === partnerId);
            if (exists) {
              if (exists.messages.length > 0) return prev;
              return prev.map(c => {
                if (c.participantId !== partnerId) return c;
                return {
                  ...c,
                  messages: match.messages,
                  hasMore: match.hasMore,
                  nextCursor: match.nextCursor
                };
              });
            } else {
              return [...prev, match];
            }
          });
        }
      } catch (err) {
        console.warn('Failed to load cached active messages', err);
      }
    }

    try {
      const res = await messagesApi.getConversationMessages(partnerId, cursor);
      const formattedMsgs = res.data.map(m => ({
        id: m.id,
        senderId: m.sender_id === user?.id ? 'me' : m.sender_id,
        text: m.body,
        postId: m.post_id || null,
        reactions: m.reactions || [],
        ts: new Date(m.created_at).getTime(),
        status: 'sent'
      }));

      const hasMore = res.pagination?.hasMore || false;
      const nextCursor = res.pagination?.nextCursor || null;

      setDmConversations(prev => {
        const next = prev.map(c => {
          if (c.participantId !== partnerId) return c;

          const existingOptimistic = c.messages.filter(m => m.status === 'sending' || m.status === 'failed');
          const existingIds = new Set(formattedMsgs.map(m => m.id));

          let mergedMessages;
          if (cursor) {
            const uniqueOlder = formattedMsgs.filter(m => !c.messages.some(em => em.id === m.id));
            mergedMessages = [...uniqueOlder, ...c.messages];
          } else {
            mergedMessages = [...formattedMsgs, ...existingOptimistic.filter(om => !existingIds.has(om.id))];
          }

          mergedMessages.sort((a, b) => a.ts - b.ts);

          return {
            ...c,
            messages: mergedMessages,
            hasMore,
            nextCursor
          };
        });
        chatStorage.saveConversations(next);
        return next;
      });
    } catch (err) {
      console.error('Failed to load messages for conversation', err);
    }
  }, [user]);

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

  const sendDm = useCallback(async (participantId, text, postId = null, tempIdInput = null) => {
    if (!text.trim()) return;
    const tempId = tempIdInput || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const formattedMsg = {
      id: tempId,
      senderId: 'me',
      text: text.trim(),
      postId: postId,
      reactions: [],
      ts: Date.now(),
      status: 'sending'
    };

    // Optimistic state update
    setDmConversations(prev => {
      const exists = prev.some(c => c.participantId === participantId);
      let next;
      if (!exists) {
        const connUser = connectionsList.find(u => u.id === participantId);
        const stub = {
          id: `dm-${participantId}`,
          participantId,
          participantUser: connUser ? {
            id: connUser.id,
            username: `${connUser.first_name || ''} ${connUser.last_name || ''}`.trim() || 'User',
            firstName: connUser.first_name,
            lastName: connUser.last_name,
            avatar_url: connUser.avatar_url
          } : { id: participantId, username: 'User' },
          messages: [formattedMsg],
          unread: 0,
        };
        next = [...prev, stub];
      } else {
        next = prev.map(c => {
          if (c.participantId !== participantId) return c;
          if (c.messages.some(m => m.id === tempId)) {
            return {
              ...c,
              messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'sending' } : m)
            };
          }
          return {
            ...c,
            messages: [...c.messages, formattedMsg]
          };
        });
      }
      chatStorage.saveConversations(next);
      return next;
    });

    // PERF: Try WebSocket-first for 0-latency delivery, fallback to HTTP
    const ws = window.__KOVO_WS__;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send via WebSocket — message is relayed instantly to receiver
      ws.send(JSON.stringify({
        type: 'send_dm',
        receiverId: participantId,
        text: text.trim(),
        postId: postId,
        tempId: tempId,
      }));

      // Mark as sent immediately (WebSocket relay is near-instant)
      setDmConversations(prev => {
        const next = prev.map(c => {
          if (c.participantId !== participantId) return c;
          return {
            ...c,
            messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'sent' } : m)
          };
        });
        chatStorage.saveConversations(next);
        return next;
      });
    } else {
      // Fallback: Send via HTTP API
      try {
        const newMsg = await messagesApi.sendMessage(participantId, text.trim(), postId);
        setDmConversations(prev => {
          const next = prev.map(c => {
            if (c.participantId !== participantId) return c;
            return {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === tempId) {
                  return {
                    ...m,
                    id: newMsg.id,
                    status: 'sent',
                    ts: new Date(newMsg.created_at).getTime()
                  };
                }
                return m;
              })
            };
          });
          chatStorage.saveConversations(next);
          return next;
        });
      } catch (err) {
        console.error('Failed to send message:', err);
        setDmConversations(prev => {
          const next = prev.map(c => {
            if (c.participantId !== participantId) return c;
            return {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === tempId) {
                  return { ...m, status: 'failed' };
                }
                return m;
              })
            };
          });
          chatStorage.saveConversations(next);
          return next;
        });
        showToast(err.message || 'Failed to send message', 'error');
      }
    }
  }, [showToast, connectionsList]);

  const retrySendDm = useCallback(async (participantId, tempId) => {
    const conv = dmConversations.find(c => c.participantId === participantId);
    if (!conv) return;
    const msg = conv.messages.find(m => m.id === tempId);
    if (!msg) return;
    await sendDm(participantId, msg.text, msg.postId, tempId);
  }, [dmConversations, sendDm]);

  useEffect(() => {
    if (isLoggedIn) {
      loadConversations();
    } else {
      setDmConversations([]);
      setActiveDmUserId(null);
    }
  }, [isLoggedIn, loadConversations]);

  useEffect(() => {
    const handleRefresh = () => {
      loadConversations();
    };
    window.addEventListener('connection-accepted-refresh', handleRefresh);
    return () => window.removeEventListener('connection-accepted-refresh', handleRefresh);
  }, [loadConversations]);

  useEffect(() => {
    if (isLoggedIn && activeDmUserId) {
      loadActiveMessages(activeDmUserId);
    }
  }, [isLoggedIn, activeDmUserId, loadActiveMessages]);

  useEffect(() => {
    const handleWsMessage = (e) => {
      const { message, partnerId } = e.detail;
      let senderName = 'someone';

      setDmConversations(prev => {
        const exists = prev.find(c => c.participantId === partnerId);
        let next;
        if (exists) {
          next = prev.map(c => {
            if (c.participantId !== partnerId) return c;
            if (c.messages.some(m => m.id === message.id)) return c;
            return {
              ...c,
              messages: [...c.messages, { ...message, reactions: message.reactions || [], status: message.status || 'sent' }]
            };
          });
        } else {
          const connUser = connectionsList.find(u => u.id === partnerId);
          if (connUser) {
            senderName = `${connUser.first_name || ''} ${connUser.last_name || ''}`.trim() || 'User';
          }
          const stub = {
            id: `dm-${partnerId}`,
            participantId: partnerId,
            participantUser: connUser ? {
              id: connUser.id,
              username: senderName,
              firstName: connUser.first_name,
              lastName: connUser.last_name,
              avatar_url: connUser.avatar_url
            } : { id: partnerId, username: 'User' },
            messages: [{ ...message, reactions: message.reactions || [], status: message.status || 'sent' }],
            unread: activeDmUserId === partnerId ? 0 : 1,
          };
          next = [...prev, stub];
          loadConversations();
        }
        chatStorage.saveConversations(next);
        return next;
      });

      if (message.senderId !== 'me' && activeDmUserId !== partnerId) {
        const connUser = connectionsList.find(u => u.id === partnerId);
        const name = connUser ? `${connUser.first_name || ''} ${connUser.last_name || ''}`.trim() || 'User' : 'someone';
        showToast(`New message from ${name}`, 'info');
      }
    };

    const handleWsMessageDelivered = (e) => {
      const { messageId, receiverId } = e.detail;
      setDmConversations(prev => {
        const next = prev.map(c => {
          if (c.participantId !== receiverId) return c;
          return {
            ...c,
            messages: c.messages.map(m => m.id === messageId ? { ...m, status: 'delivered' } : m)
          };
        });
        chatStorage.saveConversations(next);
        return next;
      });
    };

    const handleWsReaction = (e) => {
      const { targetId, targetType, userId, action, emoji } = e.detail;
      if (targetType !== 'message') return;

      setDmConversations(prev => {
        const next = prev.map(c => {
          const msg = c.messages.find(m => m.id === targetId);
          if (msg) {
            let updatedReactions = [...(msg.reactions || [])];
            if (action === 'removed') {
              updatedReactions = updatedReactions.filter(r => !(r.userId === userId && r.emoji === emoji));
            } else if (action === 'updated') {
              updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
            } else if (action === 'added') {
              if (!updatedReactions.some(r => r.userId === userId)) {
                updatedReactions.push({ userId, emoji });
              } else {
                updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
              }
            }
            return {
              ...c,
              messages: c.messages.map(m => m.id === targetId ? { ...m, reactions: updatedReactions } : m)
            };
          }
          return c;
        });
        chatStorage.saveConversations(next);
        return next;
      });
    };

    // PERF: Handle WebSocket DM persistence confirmations (update temp IDs with real IDs)
    const handleWsDmPersisted = (e) => {
      const { tempId, message, partnerId } = e.detail;
      setDmConversations(prev => {
        const next = prev.map(c => {
          if (c.participantId !== partnerId) return c;
          return {
            ...c,
            messages: c.messages.map(m => {
              if (m.id === tempId) {
                return {
                  ...m,
                  id: message.id,
                  ts: message.ts,
                  status: 'sent',
                };
              }
              return m;
            })
          };
        });
        chatStorage.saveConversations(next);
        return next;
      });
    };

    // PERF: Handle WebSocket DM errors
    const handleWsDmError = (e) => {
      const { tempId, error } = e.detail;
      setDmConversations(prev => {
        const next = prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'failed' } : m)
        }));
        chatStorage.saveConversations(next);
        return next;
      });
      showToast(error || 'Failed to send message', 'error');
    };

    window.addEventListener('ws-new-message', handleWsMessage);
    window.addEventListener('ws-message-delivered', handleWsMessageDelivered);
    window.addEventListener('ws-reaction-update', handleWsReaction);
    window.addEventListener('ws-dm-persisted', handleWsDmPersisted);
    window.addEventListener('ws-dm-error', handleWsDmError);
    return () => {
      window.removeEventListener('ws-new-message', handleWsMessage);
      window.removeEventListener('ws-message-delivered', handleWsMessageDelivered);
      window.removeEventListener('ws-reaction-update', handleWsReaction);
      window.removeEventListener('ws-dm-persisted', handleWsDmPersisted);
      window.removeEventListener('ws-dm-error', handleWsDmError);
    };
  }, [activeDmUserId, loadConversations, showToast, connectionsList]);

  const value = useMemo(() => ({
    dmConversations, setDmConversations, activeDmUserId, setActiveDmUserId, startDm, sendDm, retrySendDm, loadActiveMessages
  }), [dmConversations, activeDmUserId, startDm, sendDm, retrySendDm, loadActiveMessages]);

  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}

// ─── Notification Provider ───
export function NotificationProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const { showToast } = useUI();
  const [notifications, setNotifications] = useState([]);
  const seenIdsRef = useRef(new Set());

  const loadNotifications = useCallback(async (silent = false) => {
    try {
      const res = await notificationsApi.getNotifications();
      const normalized = (res.data || []).map(normaliseNotification);
      
      if (silent) {
        normalized.forEach(n => {
          if (!seenIdsRef.current.has(n.id)) {
            if (!n.read) {
              if (n.type === 'helpful_mark' || n.type === 'helpful') {
                showToast(n.content || "+10 Points! Your comment was marked helpful.", 'success');
              } else {
                showToast(n.title || "New notification received.", 'info');
              }
              if (n.type === 'connection_accepted' || n.type === 'connection_request') {
                window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
              }
            }
            seenIdsRef.current.add(n.id);
          }
        });
      } else {
        normalized.forEach(n => {
          seenIdsRef.current.add(n.id);
          // If a new connection was accepted or requested on page load, also refresh conversations/pending
          if (!n.read && (n.type === 'connection_accepted' || n.type === 'connection_request')) {
            window.dispatchEvent(new CustomEvent('connection-accepted-refresh'));
          }
        });
      }
      
      setNotifications(normalized);
    } catch { /* silent */ }
  }, [showToast]);

  const markAllRead = useCallback(async () => {
    try { await notificationsApi.markAllRead(); } catch { /* best effort */ }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadNotifications(false);
    } else {
      setNotifications([]);
      seenIdsRef.current.clear();
    }
  }, [isLoggedIn, loadNotifications]);

  // Real-time Supabase notifications listener
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          loadNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, user?.id, loadNotifications]);

  // Real-time WebSocket notifications listener
  useEffect(() => {
    if (!isLoggedIn) return;
    const handleWsNotification = () => {
      loadNotifications(true);
    };
    window.addEventListener('ws-new-notification', handleWsNotification);
    return () => window.removeEventListener('ws-new-notification', handleWsNotification);
  }, [isLoggedIn, loadNotifications]);

  const value = useMemo(() => ({
    notifications, setNotifications, markAllRead, loadNotifications
  }), [notifications, markAllRead, loadNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// ─── Composed Root Provider ───
export function AppProvider({ children }) {
  return (
    <ThemeProvider>
      <UIProvider>
        <AuthProvider>
          <NavigationProvider>
            <SearchProvider>
              <PostsProvider>
                <ConnectionsProvider>
                  <DmProvider>
                    <NotificationProvider>
                      {children}
                    </NotificationProvider>
                  </DmProvider>
                </ConnectionsProvider>
              </PostsProvider>
            </SearchProvider>
          </NavigationProvider>
        </AuthProvider>
      </UIProvider>
    </ThemeProvider>
  );
}

// ─── Unified Hook (Backward Compatible) ───
export function useApp() {
  const theme = useContext(ThemeContext);
  const ui = useContext(UIContext);
  const auth = useContext(AuthContext);
  const navigation = useContext(NavigationContext);
  const search = useContext(SearchContext);
  const posts = useContext(PostsContext);
  const connections = useContext(ConnectionsContext);
  const dm = useContext(DmContext);
  const notifications = useContext(NotificationContext);

  if (!theme || !ui || !auth || !navigation || !search || !posts || !connections || !dm || !notifications) {
    throw new Error('useApp must be used within AppProvider');
  }

  return {
    ...theme,
    ...ui,
    ...auth,
    ...navigation,
    ...search,
    ...posts,
    ...connections,
    ...dm,
    ...notifications,
  };
}

// ─── Custom Domain hooks ───
export const useTheme = () => useContext(ThemeContext);
export const useUI = () => useContext(UIContext);
export const useAuth = () => useContext(AuthContext);
export const useNavigation = () => useContext(NavigationContext);
export const useSearch = () => useContext(SearchContext);
export const usePosts = () => useContext(PostsContext);
export const useConnections = () => useContext(ConnectionsContext);
export const useDms = () => useContext(DmContext);
export const useNotifications = () => useContext(NotificationContext);
