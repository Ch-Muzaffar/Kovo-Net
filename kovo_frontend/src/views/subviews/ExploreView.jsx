import React from 'react';
import { usePosts, useSearch, useNavigation } from '../../context/AppContext';
import PostCard from '../../components/PostCard';

export default function ExploreView() {
  const { posts } = usePosts();
  const { searchQuery, setSearchQuery } = useSearch();
  const { navigate } = useNavigation();

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

  // Sort by likes desc
  displayPosts.sort((a, b) => b.likes - a.likes);

  // Derive tags from all posts
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
}
