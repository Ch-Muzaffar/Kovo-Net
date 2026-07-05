import React from 'react';
import { usePosts, useSearch } from '../../context/AppContext';
import PostCard from '../../components/PostCard';
import Icon from '../../components/Icon';

export default function BookmarksView() {
  const { posts, bookmarkedPosts } = usePosts();
  const { searchQuery } = useSearch();

  // Filter posts based on bookmarked set
  let displayPosts = posts.filter(p => bookmarkedPosts.has(p.id));

  // Filter posts based on searchQuery if present
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

  return (
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
  );
}
