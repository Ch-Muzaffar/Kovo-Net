import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getFileIcon, getFileColor } from '../utils/helpers';
import Icon from './Icon';

const DEFAULT_TAGS = [
  'Engineering', 'Design', 'Marketing', 'Productivity', 'React', 'NodeJS', 'Database', 'Supabase', 'Python', 'Web3', 'Career', 'Mental Health', 'Networking'
];

export default function ModalRoot() {
  const { 
    modal, 
    closeModal, 
    user, 
    posts, 
    submitPost, 
    deletePost, 
    toggleLike, 
    showToast,
    reportedContent,
    reportContent,
    connectionsList,
    sendDm
  } = useApp();

  const [createPostForm, setCreatePostForm] = useState({ content: '', tags: [], files: [] });
  const [tagInput, setTagInput] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [errors, setErrors] = useState({});
  const [shareMode, setShareMode] = useState('menu');
  const [chatSearch, setChatSearch] = useState('');

  // Reset form states whenever modal type changes to ensure clean forms on open
  useEffect(() => {
    if (modal) {
      setCreatePostForm({ content: '', tags: [], files: [] });
      setTagInput('');
      setReportReason('');
      setReportDetails('');
      setErrors({});
      setShareMode('menu');
      setChatSearch('');
    }
  }, [modal]);

  if (!modal) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  };

  // CREATE POST MODAL HANDLERS
  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    const newFiles = uploadedFiles.map(file => {
      const extension = file.name.split('.').pop().toLowerCase();
      let type = 'file';
      if (['pdf'].includes(extension)) type = 'pdf';
      else if (['png', 'jpg', 'jpeg', 'gif'].includes(extension)) type = 'image';
      else if (['py', 'js', 'html', 'css', 'txt', 'doc', 'docx'].includes(extension)) type = 'code';
      else if (['zip', 'rar'].includes(extension)) type = 'zip';

      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        name: file.name,
        type,
        size: `${sizeMB} MB`,
        rawFile: file
      };
    });

    setCreatePostForm(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
  };

  const removeFile = (index) => {
    setCreatePostForm(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleCreatePostSubmit = (e) => {
    e.preventDefault();
    const content = createPostForm.content.trim();
    const newErrors = {};

    if (!content) newErrors.content = 'Post content cannot be empty.';
    else if (content.length < 10) newErrors.content = 'Post content must be at least 10 characters.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    submitPost(content, createPostForm.tags, createPostForm.files);
    showToast('Post created successfully!', 'success');
    closeModal();
  };

  // REPORT HANDLERS
  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportReason) {
      showToast('Please select a reason.', 'warning');
      return;
    }
    reportContent(modal.props.contentId);
    showToast('Report submitted. Thank you for keeping KOVO NETWORKS safe.', 'success');
    closeModal();
  };

  // COPY LINK HANDLER
  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin + `/post/${modal.props.postId}`)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Could not copy link.', 'error'));
    } else {
      showToast('Link copied!', 'success');
    }
    closeModal();
  };

  // RENDER CORRESPONDING MODAL CONTENT
  let content = null;
  let maxW = 'max-w-lg';

  switch (modal.type) {
    case 'create-post':
      const allAvailableTags = Array.from(new Set([
        ...DEFAULT_TAGS,
        ...posts.flatMap(p => p.tags || [])
      ])).sort();
      const availableTags = allAvailableTags.filter(t => !createPostForm.tags.includes(t));

      maxW = 'max-w-lg';
      content = (
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">Create Post</h2>
            <button 
              type="button"
              className="p-2 rounded-lg hover:bg-[rgba(15,23,42,0.05)] transition-colors" 
              onClick={closeModal} 
              aria-label="Close"
            >
              <Icon icon="lucide:x" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }} />
            </button>
          </div>
          <form onSubmit={handleCreatePostSubmit} noValidate>
            <div className="flex items-start gap-3 mb-4">
              <div 
                className="avatar avatar-sm" 
                style={{ background: user.username ? `var(--gradient-btn)` : '#ccc' }}
              >
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{user.username}</div>
                <div className="text-xs text-[var(--text-muted)]">Posting publicly</div>
              </div>
            </div>
            <div className="mb-4">
              <textarea 
                className={`input-field text-sm ${errors.content ? 'error' : ''}`}
                placeholder="Describe your problem or question in detail..." 
                rows="5"
                value={createPostForm.content}
                onChange={e => {
                  setCreatePostForm(prev => ({ ...prev, content: e.target.value }));
                  setErrors(prev => ({ ...prev, content: null }));
                }}
                aria-label="Post content"
              />
              <p className={`error-text ${errors.content ? 'visible' : ''}`}>{errors.content}</p>
            </div>
            
            {/* Tag Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Tags (Click to add or type custom)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {createPostForm.tags.map((t, i) => (
                  <span key={i} className="tag flex items-center gap-1" style={{ background: 'var(--accent-purple)', color: '#fff', border: 'none' }}>
                    {t}
                    <button 
                      type="button" 
                      className="hover:text-white ml-0.5 font-bold" 
                      onClick={() => setCreatePostForm(prev => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }))}
                      aria-label={`Remove tag ${t}`}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              
              {createPostForm.tags.length >= 5 ? (
                <p className="text-xs text-[var(--text-muted)]">Maximum 5 tags reached.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Clickable Standard Tags */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-input)]">
                    {availableTags.map(t => (
                      <button
                        key={t}
                        type="button"
                        className="tag"
                        style={{ background: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        onClick={() => {
                          setCreatePostForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
                          setErrors(prev => ({ ...prev, tags: null }));
                        }}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1" style={{ position: 'relative' }}>
                      <select 
                        className="input-field text-sm" 
                        style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        value=""
                        onChange={e => {
                          const val = e.target.value;
                          if (val && !createPostForm.tags.includes(val)) {
                            setCreatePostForm(prev => ({ ...prev, tags: [...prev.tags, val] }));
                            setErrors(prev => ({ ...prev, tags: null }));
                          }
                        }}
                        aria-label="Select a tag"
                      >
                        <option value="" disabled>Select standard tag...</option>
                        {availableTags.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <Icon icon="lucide:chevron-down" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>
                    
                    <div className="flex gap-1 flex-1">
                      <input 
                        type="text" 
                        className="input-field text-sm" 
                        placeholder="Or type custom tag..."
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = tagInput.trim();
                            if (val && !createPostForm.tags.includes(val)) {
                              setCreatePostForm(prev => ({ ...prev, tags: [...prev.tags, val] }));
                              setTagInput('');
                              setErrors(prev => ({ ...prev, tags: null }));
                            }
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        className="btn-gradient px-3" 
                        onClick={() => {
                          const val = tagInput.trim();
                          if (val && !createPostForm.tags.includes(val)) {
                            setCreatePostForm(prev => ({ ...prev, tags: [...prev.tags, val] }));
                            setTagInput('');
                            setErrors(prev => ({ ...prev, tags: null }));
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <p className={`error-text ${errors.tags ? 'visible' : ''}`}>{errors.tags}</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Attachments</label>
              <div 
                className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-6 text-center hover:border-[var(--border-hover)] transition-colors cursor-pointer" 
                onClick={() => document.getElementById('file-upload-input-react')?.click()}
                role="button" 
                tabIndex="0" 
                aria-label="Upload files"
              >
                <Icon icon="lucide:upload-cloud" style={{ fontSize: '2rem', color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p className="text-sm text-[var(--text-muted)]">Click to upload or drag & drop</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">PDF, Images, Code, ZIP (Max 10MB each)</p>
              </div>
              <input 
                type="file" 
                id="file-upload-input-react" 
                className="hidden" 
                multiple 
                accept=".pdf,.png,.jpg,.jpeg,.gif,.py,.js,.html,.css,.zip,.rar,.txt,.doc,.docx"
                onChange={handleFileUpload}
              />
              {createPostForm.files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {createPostForm.files.map((f, i) => (
                    <div key={i} className="file-attachment w-full justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon={getFileIcon(f.type)} style={{ color: getFileColor(f.type), fontSize: '1rem' }} />
                        <span className="text-sm">{f.name}</span>
                        <span className="text-xs text-[var(--text-muted)]">{f.size}</span>
                      </div>
                      <button 
                        type="button" 
                        className="text-[var(--text-muted)] hover:text-red-500" 
                        onClick={() => removeFile(i)}
                        aria-label="Remove file"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-ghost flex-1 py-3 text-sm" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-gradient flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Icon icon="lucide:send" style={{ fontSize: '1rem' }} /> Post
              </button>
            </div>
          </form>
        </div>
      );
      break;

    case 'share':
      maxW = 'max-w-md';
      const sharedPostItem = posts.find(p => p.id === modal.props?.postId);
      const postSnippet = sharedPostItem ? (sharedPostItem.content || '').slice(0, 60) + '...' : 'Shared post';

      const handleShareToFriend = async (friendId) => {
        try {
          await sendDm(friendId, `Shared a post: "${postSnippet}"`, modal.props.postId);
          showToast('Post shared in chat successfully!', 'success');
          closeModal();
        } catch (err) {
          showToast(err.message || 'Failed to share in chat', 'error');
        }
      };

      if (shareMode === 'chat') {
        const filteredConnections = connectionsList.filter(c => 
          `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(chatSearch.toLowerCase())
        );

        content = (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <button 
                type="button" 
                onClick={() => setShareMode('menu')}
                className="p-2 rounded-lg hover:bg-[rgba(15,23,42,0.05)] text-[var(--text-muted)]"
                aria-label="Back to options"
              >
                <Icon icon="lucide:arrow-left" style={{ fontSize: '1.25rem' }} />
              </button>
              <h2 className="font-display font-bold text-lg text-[var(--text-primary)] flex-1">Share in Chat</h2>
              <button 
                type="button"
                className="p-2 rounded-lg hover:bg-[rgba(15,23,42,0.05)]" 
                onClick={closeModal} 
                aria-label="Close"
              >
                <Icon icon="lucide:x" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="mb-4">
              <input 
                type="text" 
                className="input-field text-sm" 
                placeholder="Search connected friends..."
                value={chatSearch}
                onChange={e => setChatSearch(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto' }} className="space-y-2 pr-1">
              {filteredConnections.length === 0 ? (
                <p className="text-sm text-center text-[var(--text-muted)] py-4">No connected friends found.</p>
              ) : (
                filteredConnections.map(friend => {
                  const name = `${friend.first_name || ''} ${friend.last_name || ''}`.trim() || 'User';
                  const initials = ((friend.first_name?.[0] || '') + (friend.last_name?.[0] || '')).toUpperCase();
                  const avatarColor = `linear-gradient(135deg, var(--accent-purple), var(--accent-blue))`;

                  return (
                    <button 
                      key={friend.id}
                      onClick={() => handleShareToFriend(friend.id)}
                      className="w-full text-left p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-purple)] hover:bg-[rgba(15,118,110,0.04)] transition-all flex items-center gap-3 cursor-pointer"
                      style={{ background: 'none' }}
                    >
                      <div 
                        className="avatar avatar-sm flex items-center justify-center text-white font-bold"
                        style={{ background: avatarColor, width: '32px', height: '32px', borderRadius: '50%', fontSize: '0.8rem' }}
                      >
                        {initials || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">{friend.profession || 'Connection'}</div>
                      </div>
                      <Icon icon="lucide:send" style={{ fontSize: '1rem', color: 'var(--accent-purple)' }} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      } else {
        content = (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">Share Post</h2>
              <button 
                type="button"
                className="p-2 rounded-lg hover:bg-[rgba(15,23,42,0.05)]" 
                onClick={closeModal} 
                aria-label="Close"
              >
                <Icon icon="lucide:x" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Primary Option: Share in Chat */}
              <button 
                className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-3 font-semibold mb-2"
                onClick={() => setShareMode('chat')}
              >
                <Icon icon="lucide:message-square" style={{ fontSize: '1.25rem' }} /> Share in Chat
              </button>
              
              <div className="h-px bg-[var(--border-color)] my-2"></div>

              <button className="btn-ghost w-full py-3 text-sm flex items-center gap-3" onClick={handleCopyLink}>
                <Icon icon="lucide:link" style={{ fontSize: '1.25rem', color: 'var(--accent-purple)' }} /> Copy Link
              </button>
              <button className="btn-ghost w-full py-3 text-sm flex items-center gap-3" onClick={closeModal}>
                <Icon icon="lucide:twitter" style={{ fontSize: '1.25rem', color: '#1DA1F2' }} /> Share on Twitter
              </button>
              <button className="btn-ghost w-full py-3 text-sm flex items-center gap-3" onClick={closeModal}>
                <Icon icon="lucide:linkedin" style={{ fontSize: '1.25rem', color: '#0077B5' }} /> Share on LinkedIn
              </button>
              <button className="btn-ghost w-full py-3 text-sm flex items-center gap-3" onClick={closeModal}>
                <Icon icon="lucide:message-circle" style={{ fontSize: '1.25rem', color: '#25D366' }} /> Share on WhatsApp
              </button>
            </div>
          </div>
        );
      }
      break;

    case 'report':
      maxW = 'max-w-md';
      content = (
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">Report Content</h2>
            <button 
              type="button"
              className="p-2 rounded-lg hover:bg-[rgba(15,23,42,0.05)]" 
              onClick={closeModal} 
              aria-label="Close"
            >
              <Icon icon="lucide:x" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }} />
            </button>
          </div>
          <form onSubmit={handleReportSubmit} noValidate>
            <div className="space-y-2 mb-5">
              {['Spam', 'Inappropriate Content', 'Disturbing / Harmful', 'Misinformation', 'Other'].map(reason => (
                <label 
                  key={reason} 
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] cursor-pointer hover:border-[var(--border-hover)] transition-colors"
                >
                  <input 
                    type="radio" 
                    name="report-reason" 
                    value={reason} 
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-[var(--accent-purple)]" 
                    required 
                  />
                  <span className="text-sm text-[var(--text-secondary)]">{reason}</span>
                </label>
              ))}
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Additional details (optional)
              </label>
              <textarea 
                className="input-field text-sm" 
                rows="3" 
                placeholder="Provide more context..."
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-ghost flex-1 py-2.5 text-sm" onClick={closeModal}>Cancel</button>
              <button 
                type="submit" 
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      );
      break;

    case 'post-menu':
      const isOwner = posts.find(p => p.id === modal.props.postId)?.userId === user.id;
      const isReported = reportedContent.has(modal.props.postId);
      maxW = 'max-w-xs';
      content = (
        <div className="p-2">
          <button 
            className="sidebar-item text-sm w-full" 
            onClick={() => { toggleLike(modal.props.postId); showToast('Post status toggled!', 'success'); closeModal(); }}
          >
            <Icon icon="lucide:bookmark" style={{ fontSize: '1.125rem' }} /> Bookmark
          </button>
          <button className="sidebar-item text-sm w-full" onClick={handleCopyLink}>
            <Icon icon="lucide:link" style={{ fontSize: '1.125rem' }} /> Copy Link
          </button>
          {!isOwner ? (
            <button 
              className={`sidebar-item text-sm w-full ${isReported ? 'text-[var(--text-muted)]' : 'text-red-400'}`} 
              onClick={() => {
                if (isReported) return;
                openModal('report', { contentId: modal.props.postId, contentType: 'post' });
              }}
            >
              <Icon icon="lucide:flag" style={{ fontSize: '1.125rem' }} /> {isReported ? 'Already Reported' : 'Report Post'}
            </button>
          ) : (
            <button 
              className="sidebar-item text-sm w-full text-red-400" 
              onClick={() => {
                deletePost(modal.props.postId);
                showToast('Post deleted.', 'info');
                closeModal();
              }}
            >
              <Icon icon="lucide:trash-2" style={{ fontSize: '1.125rem' }} /> Delete Post
            </button>
          )}
          <div className="h-px bg-[var(--border-color)] my-1"></div>
          <button className="sidebar-item text-sm w-full text-[var(--text-muted)]" onClick={closeModal}>Cancel</button>
        </div>
      );
      break;

    default:
      return null;
  }

  return (
    <div 
      className="modal-overlay active" 
      onClick={handleOverlayClick}
      role="dialog" 
      aria-modal="true"
    >
      <div className={`modal-content ${maxW}`}>
        {content}
      </div>
    </div>
  );
}
