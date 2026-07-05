import React, { useRef, useEffect } from 'react';
import { usePosts, useSearch, useUI } from '../../context/AppContext';
import PostCard from '../../components/PostCard';
import Icon from '../../components/Icon';

export default function MainFeedView() {
  const { posts, loadFeed, feedCursor, feedHasMore, loading } = usePosts();
  const { searchQuery } = useSearch();
  const { openModal } = useUI();
  const sentinelRef = useRef(null);

  // Filter posts based on searchQuery
  let displayPosts = [...posts];
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    displayPosts = displayPosts.filter(p => {
      if (!p) return false;
      const contentMatch = p.content && typeof p.content === 'string' && p.content.toLowerCase().includes(q);
      const tagsMatch = Array.isArray(p.tags) && p.tags.some(t => t && typeof t === 'string' && t.toLowerCase().includes(q));
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
  displayPosts.sort((a, b) => {
    if (a.isTarget && !b.isTarget) return -1;
    if (!a.isTarget && b.isTarget) return 1;
    return b.createdAt - a.createdAt;
  });

  // Infinite scroll — observe the sentinel div at the bottom of the list
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feedHasMore && !loading.feed && !searchQuery) {
          loadFeed(feedCursor);
        }
      },
      { rootMargin: '200px' } // trigger 200px before the user hits the very bottom
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedHasMore, feedCursor, loading.feed, searchQuery, loadFeed]);

  return (
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

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: '1px', marginTop: '1rem' }} />

      {/* Loading indicator for next page */}
      {loading.feed && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Icon icon="lucide:loader-2" style={{ fontSize: '1.1rem', animation: 'spin 1s linear infinite' }} />
          <span>Loading more posts…</span>
        </div>
      )}

      {/* End of feed indicator */}
      {!feedHasMore && posts.length > 0 && !searchQuery && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
          <Icon icon="lucide:check-circle" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
          You're all caught up!
        </div>
      )}
    </div>
  );
}
