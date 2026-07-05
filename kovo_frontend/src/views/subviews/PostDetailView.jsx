import React, { useState, useEffect } from 'react';
import { useNavigation, usePosts, useAuth, useUI } from '../../context/AppContext';
import PostCard from '../../components/PostCard';
import Icon from '../../components/Icon';
import { getAvatarGradient, getInitials, timeAgo } from '../../utils/helpers';
import { reactionsApi } from '../../api/reactions';

export default function PostDetailView() {
  const { selectedPostId, navigate } = useNavigation();
  const {
    posts,
    comments,
    setComments,
    addComment,
    loadComments,
    helpfulComments,
    toggleHelpful,
    voteHelpful,
    getVoteCounts,
    reportedContent
  } = usePosts();
  const { user } = useAuth();
  const { openModal, showToast } = useUI();

  const [commentInput, setCommentInput] = useState('');
  const [activeEmojiCommentId, setActiveEmojiCommentId] = useState(null);

  useEffect(() => {
    if (selectedPostId) {
      loadComments(selectedPostId);
    }
  }, [selectedPostId, loadComments]);

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

  const handleCommentSubmitLocal = () => {
    if (!commentInput.trim()) {
      showToast('Comment text cannot be empty.', 'warning');
      return;
    }
    addComment(activePost.id, commentInput.trim());
    setCommentInput('');
    showToast('Comment posted!', 'success');
  };

  const handleToggleCommentReaction = async (commentId, emoji) => {
    try {
      const res = await reactionsApi.toggleReaction(commentId, 'comment', emoji);
      showToast(`Reaction ${res.action}!`, 'success');
      
      // Update local comments state immediately
      setComments(prev => {
        const updated = {};
        for (const [postId, commentList] of Object.entries(prev)) {
          updated[postId] = commentList.map(item => {
            if (item.id !== commentId) return item;
            let updatedReactions = [...(item.reactions || [])];
            const userId = user?.id;
            if (res.action === 'removed') {
              updatedReactions = updatedReactions.filter(r => !(r.userId === userId && r.emoji === emoji));
            } else if (res.action === 'updated') {
              updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
            } else if (res.action === 'added') {
              if (!updatedReactions.some(r => r.userId === userId)) {
                updatedReactions.push({ userId, emoji });
              } else {
                updatedReactions = updatedReactions.map(r => r.userId === userId ? { ...r, emoji } : r);
              }
            }
            return { ...item, reactions: updatedReactions };
          });
        }
        return updated;
      });
    } catch (err) {
      showToast('Failed to toggle reaction', 'error');
    }
  };

  return (
    <div className="page-enter">
      <button 
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-5 transition-colors" 
        onClick={() => navigate('feed')} 
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
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
                <button className="btn-gradient px-4 py-2 text-sm" onClick={handleCommentSubmitLocal}>
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
              const isHelpful = c.helpful || helpfulComments.has(c.id);
              const canMarkHelpful = isOwner && c.userId !== user.id;
              const isCommentPosting = c.status === 'posting';
              return (
                <div
                  key={c.id}
                  className="card p-4"
                  style={{
                    opacity: isCommentPosting ? 0.65 : 1,
                    pointerEvents: isCommentPosting ? 'none' : 'auto',
                    position: 'relative',
                    transition: 'opacity 0.2s'
                  }}
                >
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
                      
                      {/* Action buttons & emoji reaction triggers */}
                      <div className="flex items-center gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
                        {(() => {
                          const { helpfulCount, myVote } = getVoteCounts(c.id);
                          return (
                            <button
                              className={`engage-btn text-xs${myVote === 'helpful' ? ' helpful' : ''}`}
                              onClick={() => voteHelpful(c.id, 'helpful')}
                              aria-label="Mark comment as helpful"
                              aria-pressed={myVote === 'helpful'}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Icon icon="lucide:check-circle" style={{ fontSize: '0.875rem', fill: myVote === 'helpful' ? 'var(--success)' : 'none' }} />
                              <span style={{ fontWeight: 600 }}>Helpful</span>
                              {helpfulCount > 0 && <span style={{ opacity: 0.85 }}>({helpfulCount})</span>}
                            </button>
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
                        
                        {/* Emoji reaction picker popup trigger */}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button 
                            className="engage-btn text-xs" 
                            onClick={() => setActiveEmojiCommentId(activeEmojiCommentId === c.id ? null : c.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Icon icon="lucide:smile" style={{ fontSize: '0.875rem' }} />
                            <span>React</span>
                          </button>
                          {activeEmojiCommentId === c.id && (
                            <div 
                              style={{
                                position: 'absolute', bottom: '100%', left: 0, 
                                background: 'var(--bg-glass)', backdropFilter: 'blur(16px)',
                                border: '1px solid var(--border-color)', borderRadius: '20px', 
                                padding: '4px 8px', display: 'flex', gap: '6px', zIndex: 10,
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', marginBottom: '6px'
                              }}
                            >
                              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => {
                                const hasReacted = c.reactions?.some(r => r.userId === user?.id && r.emoji === emoji);
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      handleToggleCommentReaction(c.id, emoji);
                                      setActiveEmojiCommentId(null);
                                    }}
                                    style={{
                                      fontSize: '1.25rem', background: hasReacted ? 'rgba(15, 118, 110, 0.15)' : 'none',
                                      border: 'none',
                                      borderRadius: '50%', padding: '2px', cursor: 'pointer',
                                      transition: 'transform 0.1s'
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

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

                      {/* Display active comment reactions */}
                      {c.reactions && c.reactions.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {(() => {
                            const grouped = {};
                            c.reactions.forEach(r => {
                              grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
                            });
                            return Object.entries(grouped).map(([emoji, count]) => {
                              const myReaction = c.reactions.some(r => r.userId === user?.id && r.emoji === emoji);
                              return (
                                <button 
                                  key={emoji}
                                  onClick={() => handleToggleCommentReaction(c.id, emoji)}
                                  style={{
                                    fontSize: '0.725rem', background: myReaction ? 'rgba(15, 118, 110, 0.12)' : 'var(--bg-card)',
                                    border: '1px solid ' + (myReaction ? 'var(--primary-color)' : 'var(--border-color)'),
                                    borderRadius: '12px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '2px',
                                    cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s'
                                  }}
                                >
                                  <span>{emoji}</span>
                                  {count > 1 && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{count}</span>}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )}
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
}
