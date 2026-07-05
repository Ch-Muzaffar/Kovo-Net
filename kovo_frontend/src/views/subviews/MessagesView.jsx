import React, { useState, useRef, useEffect } from 'react';
import { useDms, useUI, useNavigation, usePosts, useAuth } from '../../context/AppContext';
import Icon from '../../components/Icon';
import { getAvatarGradient, getInitials, timeAgo } from '../../utils/helpers';
import { reactionsApi } from '../../api/reactions';

export default function MessagesView() {
  const {
    dmConversations,
    activeDmUserId,
    setActiveDmUserId,
    openConversation,
    sendDm,
    retrySendDm,
    deleteDm,
    loadActiveMessages,
    setDmConversations
  } = useDms();
  const { uploadFileToCloudinary, showToast, openModal } = useUI();
  const { navigate } = useNavigation();
  const { posts } = usePosts();
  const { user } = useAuth();

  const [dmInput, setDmInput] = useState('');
  const [dmUploading, setDmUploading] = useState(false);
  const dmAttachmentRef = useRef(null);
  // Sentinel ref — scrolled into view on every new message
  const messagesEndRef = useRef(null);

  const [loadingMore, setLoadingMore] = useState(false);
  const [contextMenuMsg, setContextMenuMsg] = useState(null); // { id, isMe, text, ts, reactions }
  const longPressTimers = useRef({});

  const activeConv = activeDmUserId
    ? dmConversations.find(c => c.participantId === activeDmUserId)
    : null;

  // Auto-scroll to bottom when a new message arrives in the active chat
  useEffect(() => {
    if (!activeConv) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages?.length, activeDmUserId]);



  const handleSendDm = () => {
    if (!dmInput.trim() || !activeDmUserId) return;
    sendDm(activeDmUserId, dmInput.trim());
    setDmInput('');
  };

  const handleLoadMoreMessages = async () => {
    if (!activeConv || !activeConv.nextCursor || loadingMore) return;
    setLoadingMore(true);
    await loadActiveMessages(activeDmUserId, activeConv.nextCursor);
    setLoadingMore(false);
  };

  // Long-press detectors
  const handleTouchStart = (msg, isMe) => (e) => {
    if (longPressTimers.current[msg.id]) {
      clearTimeout(longPressTimers.current[msg.id]);
    }
    longPressTimers.current[msg.id] = setTimeout(() => {
      setContextMenuMsg({
        id: msg.id,
        isMe,
        text: msg.text,
        ts: msg.ts,
        reactions: msg.reactions || []
      });
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = (msg) => () => {
    if (longPressTimers.current[msg.id]) {
      clearTimeout(longPressTimers.current[msg.id]);
      delete longPressTimers.current[msg.id];
    }
  };

  const handleToggleReactionLocal = async (targetId, targetType, emoji) => {
    try {
      const res = await reactionsApi.toggleReaction(targetId, targetType, emoji);
      showToast(`Reaction ${res.action}!`, 'success');
      setContextMenuMsg(null);

      // Snappy UI update
      setDmConversations(prev => {
        return prev.map(c => {
          const msg = c.messages.find(m => m.id === targetId);
          if (msg) {
            let updatedReactions = [...(msg.reactions || [])];
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
            return {
              ...c,
              messages: c.messages.map(m => m.id === targetId ? { ...m, reactions: updatedReactions } : m)
            };
          }
          return c;
        });
      });
    } catch (err) {
      showToast('Failed to toggle reaction', 'error');
    }
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
    <div className="page-enter messaging-container">
      {/* Conversation List Panel */}
      <div className={`messages-list-panel ${activeConv ? 'hidden-mobile' : 'full-width'}`}>
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
                  onClick={() => openConversation(conv.participantId)}
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
        <div className="messages-chat-panel">
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
            {activeConv.hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                <button
                  onClick={handleLoadMoreMessages}
                  disabled={loadingMore}
                  className="btn-secondary"
                  style={{ fontSize: '0.725rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Icon icon="lucide:arrow-up" style={{ fontSize: '0.8rem' }} />
                  {loadingMore ? 'Loading older messages...' : 'Load older messages'}
                </button>
              </div>
            )}

            {activeConv.messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                <Icon icon="lucide:message-circle" style={{ fontSize: '3rem', opacity: 0.4, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.875rem' }}>No messages yet. Say hello!</p>
              </div>
            ) : (
              activeConv.messages.map(msg => {
                const isMe = msg.senderId === 'me';
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div 
                      onTouchStart={handleTouchStart(msg, isMe)}
                      onTouchEnd={handleTouchEnd(msg)}
                      onMouseDown={handleTouchStart(msg, isMe)}
                      onMouseUp={handleTouchEnd(msg)}
                      onMouseLeave={handleTouchEnd(msg)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenuMsg({
                          id: msg.id,
                          isMe,
                          text: msg.text,
                          ts: msg.ts,
                          reactions: msg.reactions || []
                        });
                      }}
                      style={{
                        maxWidth: '70%', padding: '0.5rem 0.875rem',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe ? 'var(--gradient-btn)' : 'rgba(15,23,42,0.06)',
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        fontSize: '0.875rem', lineHeight: 1.5,
                        cursor: 'pointer',
                        userSelect: 'none',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.05)'
                      }}
                    >
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
                              <img 
                                src={msg.text} 
                                alt="Shared Attachment" 
                                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', cursor: 'zoom-in', display: 'block' }} 
                                onClick={(e) => {
                                  e.preventDefault();
                                  openModal('image-preview', { imageUrl: msg.text });
                                }}
                              />
                            </div>
                          );
                        }
                        if (isPdf) {
                          const fileName = msg.text.split('/').pop().split('?')[0] || 'document.pdf';
                          return (
                            <button
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                color: isMe ? '#fff' : 'var(--accent-purple)',
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 500,
                                fontSize: '0.8rem',
                                textAlign: 'left'
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                openModal('pdf-preview', { pdfUrl: msg.text, fileName: fileName });
                              }}
                            >
                              <Icon icon="lucide:file-text" style={{ fontSize: '1.2rem', color: isMe ? '#fff' : 'var(--accent-purple)' }} />
                              <span>Shared PDF Document</span>
                            </button>
                          );
                        }
                        if (msg.postId) {
                          const sharedPost = (posts || []).find(p => p.id === msg.postId);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.85 }}>Shared a post:</div>
                              <div 
                                onClick={() => navigate('post-detail', { postId: msg.postId })}
                                style={{
                                  background: isMe ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.05)',
                                  border: isMe ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--border-color)',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  color: isMe ? '#fff' : 'var(--text-primary)',
                                  fontSize: '0.8rem',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Icon icon="lucide:user" style={{ fontSize: '0.8rem' }} />
                                  <span>{sharedPost ? `${sharedPost.creator?.first_name || ''} ${sharedPost.creator?.last_name || ''}`.trim() || 'Post Author' : 'Post Author'}</span>
                                </div>
                                <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.72rem', opacity: 0.9 }}>
                                  {sharedPost ? sharedPost.content : msg.text}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return msg.text;
                      })()}
                      <div style={{ 
                        fontSize: '0.6rem', 
                        opacity: 0.75, 
                        marginTop: '2px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                        gap: '4px'
                      }}>
                        <span>{timeAgo(msg.ts)}</span>
                        {isMe && (
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {msg.status === 'sending' && (
                              <Icon icon="lucide:clock" style={{ fontSize: '0.65rem', opacity: 0.6 }} />
                            )}
                            {(!msg.status || msg.status === 'sent') && (
                              <Icon icon="lucide:check" style={{ fontSize: '0.75rem', opacity: 0.8 }} />
                            )}
                            {msg.status === 'delivered' && (
                              <Icon icon="lucide:check-check" style={{ fontSize: '0.75rem', color: '#38bdf8' }} />
                            )}
                            {msg.status === 'failed' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444' }}>
                                <Icon icon="lucide:alert-circle" style={{ fontSize: '0.75rem' }} />
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    retrySendDm(activeDmUserId, msg.id); 
                                  }} 
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#f87171', 
                                    cursor: 'pointer', 
                                    fontSize: '0.65rem', 
                                    padding: 0, 
                                    textDecoration: 'underline',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Retry
                                </button>
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reactions Display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div style={{
                        display: 'flex', gap: '4px', marginTop: '3px', marginBottom: '8px', flexWrap: 'wrap',
                        justifyContent: isMe ? 'flex-end' : 'flex-start'
                      }}>
                        {(() => {
                          const grouped = {};
                          msg.reactions.forEach(r => {
                            grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
                          });
                          return Object.entries(grouped).map(([emoji, count]) => {
                            const myReaction = msg.reactions.some(r => r.userId === user?.id && r.emoji === emoji);
                            return (
                              <button 
                                key={emoji}
                                onClick={() => handleToggleReactionLocal(msg.id, 'message', emoji)}
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
                );
              })
            )}
            {/* Scroll sentinel — keeps view pinned to latest message */}
            <div ref={messagesEndRef} style={{ height: '1px', flexShrink: 0 }} />
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
          <div className="messages-chat-placeholder">
            <Icon icon="lucide:message-square" style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.875rem' }}>Select a conversation to start chatting</p>
          </div>
        )
      )}

      {/* Floating Long-Press Context Menu */}
      {contextMenuMsg && (
        <div 
          onClick={() => setContextMenuMsg(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="card"
            style={{
              width: '100%', maxWidth: '320px', borderRadius: 'var(--radius-lg)',
              padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border-color)', background: 'var(--bg-glass)',
            }}
          >
            {/* Reactions Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => {
                const hasReacted = contextMenuMsg.reactions?.some(r => r.userId === user?.id && r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleToggleReactionLocal(contextMenuMsg.id, 'message', emoji)}
                    style={{
                      fontSize: '1.5rem', background: hasReacted ? 'rgba(15, 118, 110, 0.15)' : 'none',
                      border: hasReacted ? '1px solid var(--primary-color)' : 'none',
                      borderRadius: '8px', padding: '4px', cursor: 'pointer',
                      transition: 'transform 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            
            {/* Action List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenuMsg.text);
                  showToast('Copied to clipboard!', 'success');
                  setContextMenuMsg(null);
                }}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)' }}
              >
                <Icon icon="lucide:copy" style={{ fontSize: '1.1rem' }} />
                <span>Copy Text</span>
              </button>
              
              <button
                onClick={() => {
                  alert(`Message Info\nSent: ${new Date(contextMenuMsg.ts).toLocaleString()}`);
                  setContextMenuMsg(null);
                }}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)' }}
              >
                <Icon icon="lucide:info" style={{ fontSize: '1.1rem' }} />
                <span>Info</span>
              </button>
              
              <button
                onClick={() => {
                  showToast('Forwarded!', 'success');
                  setContextMenuMsg(null);
                }}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)' }}
              >
                <Icon icon="lucide:arrow-right-right" style={{ fontSize: '1.1rem' }} />
                <span>Forward</span>
              </button>

              {/* Unsend — only for own messages within 15 minutes */}
              {contextMenuMsg.isMe && (Date.now() - contextMenuMsg.ts) < 15 * 60 * 1000 && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                  <button
                    onClick={async () => {
                      try {
                        await deleteDm(contextMenuMsg.id, activeDmUserId);
                        showToast('Message unsent.', 'info');
                      } catch {
                        showToast('Could not unsend — message may be too old.', 'error');
                      }
                      setContextMenuMsg(null);
                    }}
                    className="btn-ghost"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', color: '#ef4444' }}
                  >
                    <Icon icon="lucide:trash-2" style={{ fontSize: '1.1rem', color: '#ef4444' }} />
                    <span>Unsend Message</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
