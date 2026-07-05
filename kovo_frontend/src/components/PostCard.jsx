import React from 'react';
import { useAuth, usePosts, useNavigation, useUI } from '../context/AppContext';
import { getAvatarGradient, getInitials, timeAgo, getFileIcon, getFileColor, getLevelInfo, optimizeCloudinaryUrl } from '../utils/helpers';
import Icon from './Icon';
import { usersApi } from '../api/users.js';

export default function PostCard({ post }) {
  const { user: currentUser } = useAuth();
  const {
    likedPosts,
    toggleLike,
    bookmarkedPosts,
    toggleBookmark,
    voteHelpful,
    getVoteCounts,
  } = usePosts();
  const { navigate } = useNavigation();
  const { openModal } = useUI();

  // Use creator from API response, fall back to current user (for newly created posts)
  const creator = post.creator;
  const u = creator
    ? {
        id: creator.id || post.userId,
        username: `${creator.first_name || ''}.${creator.last_name || ''}`.toLowerCase().replace(/\s+/g, '') || 'user',
        firstName: creator.first_name || '',
        lastName: creator.last_name || '',
        department: creator.profession || creator.department || '',
        country: creator.country || '',
        points: creator.points || 0,
        type: creator.user_type || 'student',
        avatar_url: creator.avatar_url || null,
      }
    : currentUser;

  if (!u) return null;

  const liked = likedPosts.has(post.id);
  const bookmarked = bookmarkedPosts.has(post.id);
  const lvl = getLevelInfo(u.points);
  const commentsCount = post.comments || 0;

  // Normalise attachments: backend returns `attachments`, legacy posts may have `files`
  const attachments = post.attachments && post.attachments.length > 0
    ? post.attachments
    : (post.files || []);

  // Avatar: show photo if available, else initials
  const avatarEl = u.avatar_url ? (
    <img
      src={optimizeCloudinaryUrl(u.avatar_url)}
      alt={u.username}
      loading="lazy"
      style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div className="avatar" style={{ background: getAvatarGradient(u.username) }}>
      {getInitials(u.firstName + ' ' + u.lastName)}
    </div>
  );

  const isPosting = post.status === 'posting';

  return (
    <article
      className="card p-5 page-enter"
      style={{
        position: 'relative',
        opacity: isPosting ? 0.65 : 1,
        pointerEvents: isPosting ? 'none' : 'auto',
        transition: 'opacity 0.2s ease-in-out'
      }}
      aria-label={`Post by ${u.username}`}
    >
      {isPosting && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'var(--accent-purple)',
          fontWeight: 600,
          background: 'rgba(139,92,246,0.1)',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          border: '1px solid rgba(139,92,246,0.2)'
        }}>
          <Icon icon="lucide:loader" style={{ fontSize: '0.875rem', animation: 'spin 1s linear infinite' }} />
          <span>Posting...</span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <button
          className="flex-shrink-0"
          onClick={() => navigate('profile', { userId: post.userId })}
          onMouseEnter={() => usersApi.prefetchFullProfile(post.userId)}
          onMouseDown={() => usersApi.prefetchFullProfile(post.userId)}
          onTouchStart={() => usersApi.prefetchFullProfile(post.userId)}
          aria-label={`View ${u.username}'s profile`}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          {avatarEl}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="font-semibold text-sm hover:underline"
              onClick={() => navigate('profile', { userId: post.userId })}
              onMouseEnter={() => usersApi.prefetchFullProfile(post.userId)}
              onMouseDown={() => usersApi.prefetchFullProfile(post.userId)}
              onTouchStart={() => usersApi.prefetchFullProfile(post.userId)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--text-primary)' }}
            >
              {u.username}
            </button>
            <span className={`badge ${lvl.cls}`}>{lvl.name}</span>
            {u.type === 'student' ? (
              <span className="text-xs text-teal-700 font-semibold">Student</span>
            ) : (
              <span className="text-xs text-sky-700 font-semibold">Professional</span>
            )}
            <span className="text-xs text-[var(--text-muted)]">· {timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {u.department}{u.country ? ` · ${u.country}` : ''}
          </p>
        </div>
        <button
          className="engage-btn p-1.5 rounded-full"
          onClick={() => openModal('post-menu', { postId: post.id })}
          aria-label="More options"
        >
          <Icon icon="lucide:more-horizontal" style={{ fontSize: '1.125rem' }} />
        </button>
      </div>

      <div className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {post.content}
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((t, idx) => (
            <span key={idx} className="tag">@{t}</span>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {attachments.map((f, idx) => {
            const isImage = f.mime_type?.startsWith('image/') ||
              /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name || f.url || '');
            if (isImage && f.url) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openModal('image-viewer', { imageUrl: f.url, fileName: f.name || 'Post Image' });
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', display: 'block', width: '100%', textAlign: 'left' }}
                >
                  <img
                    src={optimizeCloudinaryUrl(f.url)}
                    alt={f.name || 'image'}
                    loading="lazy"
                    style={{ maxHeight: '260px', maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--border-color)', display: 'block' }}
                  />
                </button>
              );
            }
            const isPdf = f.mime_type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
            const fileType = f.type || (isPdf ? 'pdf' : (isImage ? 'image' : 'file'));
            if (isPdf) {
              return (
                <button
                  key={idx}
                  type="button"
                  className="file-attachment"
                  style={{ textDecoration: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault();
                    openModal('pdf-preview', { pdfUrl: f.url, fileName: f.name });
                  }}
                >
                  <Icon icon={getFileIcon('pdf')} style={{ color: getFileColor('pdf'), fontSize: '1.125rem' }} />
                  <span className="font-medium">{f.name || 'Preview PDF'}</span>
                  {(f.size || f.size_bytes) && <span className="text-xs text-[var(--text-muted)]">{f.size || `${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB`}</span>}
                </button>
              );
            }
            return (
              <a
                key={idx}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="file-attachment"
                style={{ textDecoration: 'none' }}
              >
                <Icon icon={getFileIcon(fileType)} style={{ color: getFileColor(fileType), fontSize: '1.125rem' }} />
                <span className="font-medium">{f.name || 'Download file'}</span>
                {(f.size || f.size_bytes) && <span className="text-xs text-[var(--text-muted)]">{f.size || `${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB`}</span>}
              </a>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 pt-2 border-t border-[var(--border-color)]" style={{ flexWrap: 'wrap' }}>
        <button
          className={`engage-btn ${liked ? 'liked' : ''}`}
          onClick={() => toggleLike(post.id)}
          aria-label={liked ? 'Unlike' : 'Like'}
          aria-pressed={liked}
        >
          <Icon
            icon="lucide:heart"
            style={{ fontSize: '1rem', fill: liked ? '#F472B6' : 'none' }}
          />
          <span>{post.likes}</span>
        </button>
        <button
          className="engage-btn"
          onClick={() => navigate('post-detail', { postId: post.id })}
          aria-label="View comments"
        >
          <Icon icon="lucide:message-circle" style={{ fontSize: '1rem' }} />
          <span>{commentsCount}</span>
        </button>
        <button
          className="engage-btn"
          onClick={() => openModal('share', { postId: post.id })}
          aria-label="Share post"
        >
          <Icon icon="lucide:share-2" style={{ fontSize: '1rem' }} />
        </button>

        {/* Helpful vote button */}
        {(() => {
          const { helpfulCount, myVote } = getVoteCounts(post.id);
          return (
            <button
              className={`engage-btn${myVote === 'helpful' ? ' helpful' : ''}`}
              onClick={() => voteHelpful(post.id, 'helpful')}
              aria-label="Mark post as helpful"
              aria-pressed={myVote === 'helpful'}
              style={{ marginLeft: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Icon icon="lucide:check-circle" style={{ fontSize: '1rem', fill: myVote === 'helpful' ? 'var(--success)' : 'none' }} />
              <span style={{ fontWeight: 600 }}>Helpful</span>
              {helpfulCount > 0 && <span style={{ opacity: 0.85 }}>({helpfulCount})</span>}
            </button>
          );
        })()}

        <div className="flex-1"></div>
        <button
          className={`engage-btn ${bookmarked ? 'helpful' : ''}`}
          onClick={() => toggleBookmark(post.id)}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
          aria-pressed={bookmarked}
        >
          <Icon
            icon="lucide:bookmark"
            style={{ fontSize: '1rem', fill: bookmarked ? 'var(--accent-purple)' : 'none' }}
          />
        </button>
      </div>
    </article>
  );
}
