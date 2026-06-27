import React from 'react';
import { useApp } from '../context/AppContext';
import { getAvatarGradient, getInitials, timeAgo, getFileIcon, getFileColor, getLevelInfo } from '../utils/helpers';
import Icon from './Icon';

export default function PostCard({ post }) {
  const {
    user: currentUser,
    likedPosts,
    toggleLike,
    bookmarkedPosts,
    toggleBookmark,
    navigate,
    openModal,
    voteHelpful,
    getVoteCounts,
  } = useApp();

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
      src={u.avatar_url}
      alt={u.username}
      style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div className="avatar" style={{ background: getAvatarGradient(u.username) }}>
      {getInitials(u.firstName + ' ' + u.lastName)}
    </div>
  );

  return (
    <article className="card p-5 page-enter" aria-label={`Post by ${u.username}`}>
      <div className="flex items-start gap-3 mb-3">
        <button
          className="flex-shrink-0"
          onClick={() => navigate('profile', { userId: post.userId })}
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

      <div className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)]" style={{ whiteSpace: 'pre-wrap' }}>
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
                <a key={idx} href={f.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={f.url}
                    alt={f.name || 'image'}
                    style={{ maxHeight: '260px', maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--border-color)', display: 'block' }}
                  />
                </a>
              );
            }
            const isPdf = f.mime_type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
            const fileType = f.type || (isPdf ? 'pdf' : (isImage ? 'image' : 'file'));
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
