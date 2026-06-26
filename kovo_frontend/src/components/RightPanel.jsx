import React from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

export default function RightPanel() {
  const { setSearchQuery, navigate } = useApp();

  const discoverCategories = [
    { icon: 'lucide:brain', color: '#0F766E', label: 'Diverse Brainstorming', sub: 'Agri-Tech (Skill Pill)', tag: 'Brainstorming' },
    { icon: 'lucide:building-2', color: '#06B6D4', label: 'Civic Tech', sub: 'Urban Planning Perspective', tag: 'CivicTech' },
    { icon: 'lucide:landmark', color: '#D97706', label: 'Policy & Governance', sub: 'Urban Planning (Skill Pill)', tag: 'Policy' },
    { icon: 'lucide:leaf', color: '#047857', label: 'Sustainability & Climate', sub: 'Green Innovation Hub', tag: 'ClimaTech' },
    { icon: 'lucide:heart-handshake', color: '#BE185D', label: 'Social Impact', sub: 'Community-Driven Solutions', tag: 'SocialImpact' },
  ];

  const trendingTags = ['NLP', 'AgriTech', 'System Design', 'UI/UX', 'ClimaTech', 'Circuits'];

  const handleTagClick = (tag) => {
    setSearchQuery(tag);
    navigate('feed');
  };

  return (
    <div id="right-pill" role="complementary" aria-label="Discover insights">
      {/* Discover header */}
      <div className="rp-header">
        <Icon icon="lucide:compass" style={{ color: 'var(--accent-purple)', fontSize: '0.9rem', flexShrink: 0 }} />
        <span className="rp-title">Discover Insights</span>
        <span className="rp-badge">30%</span>
      </div>
      <p className="rp-subtitle">Diverse topics outside your field</p>

      {/* Category rows */}
      {discoverCategories.map((cat, i) => (
        <button 
          key={i} 
          className="rp-item" 
          onClick={() => handleTagClick(cat.tag)}
          style={{ animation: `pageIn 0.3s ease ${i * 45}ms both` }}
        >
          <span className="rp-item-icon" style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}20` }}>
            <Icon icon={cat.icon} style={{ fontSize: '0.82rem', color: cat.color }} />
          </span>
          <span className="rp-item-text">
            <div className="rp-item-label">{cat.label}</div>
            <div className="rp-item-sub">{cat.sub}</div>
          </span>
          <Icon icon="lucide:chevron-right" style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.4)', flexShrink: 0 }} />
        </button>
      ))}

      <div className="rp-divider" />

      {/* Trending tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <Icon icon="lucide:trending-up" style={{ color: 'var(--accent-pink)', fontSize: '0.8rem' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Trending</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {trendingTags.map(t => (
          <span 
            key={t} 
            className="rp-tag" 
            onClick={() => handleTagClick(t)}
          >
            @{t}
          </span>
        ))}
      </div>
    </div>
  );
}
