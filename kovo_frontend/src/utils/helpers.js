// ==================== UTILITY FUNCTIONS ====================
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getAvatarGradient(name) {
  const safeName = typeof name === 'string' ? name : 'user';
  let h = 0;
  for (let i = 0; i < safeName.length; i++) h = safeName.charCodeAt(i) + ((h << 5) - h);
  const g = [
    'linear-gradient(135deg,#0F766E,#06B6D4)', 'linear-gradient(135deg,#0F766E,#D9A752)',
    'linear-gradient(135deg,#D9A752,#06B6D4)', 'linear-gradient(135deg,#06B6D4,#0284C7)',
    'linear-gradient(135deg,#0F766E,#475569)', 'linear-gradient(135deg,#D9A752,#F59E0B)',
    'linear-gradient(135deg,#0D9488,#06B6D4)', 'linear-gradient(135deg,#0F766E,#0D9488)',
  ];
  return g[Math.abs(h) % g.length];
}

export function getInitials(name) {
  const safeName = typeof name === 'string' ? name.trim() : '';
  if (!safeName) return 'U';
  return safeName.split(/\s+/).map(w => w ? w[0] : '').join('').toUpperCase().slice(0, 2) || 'U';
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getFileIcon(type) {
  if (type === 'pdf') return 'lucide:file-text';
  if (type === 'image') return 'lucide:image';
  if (type === 'code') return 'lucide:file-code';
  if (type === 'zip') return 'lucide:file-archive';
  return 'lucide:file';
}

export function getFileColor(type) {
  const m = { pdf: '#EF4444', image: '#22C55E', code: '#3B82F6', zip: '#F59E0B' };
  return m[type] || '#94A3B8';
}

export function getLevelInfo(points) {
  if (points >= 5000) return { name: 'Diamond', cls: 'level-diamond', min: 5000 };
  if (points >= 2000) return { name: 'Platinum', cls: 'level-platinum', min: 2000 };
  if (points >= 800) return { name: 'Gold', cls: 'level-gold', min: 800 };
  if (points >= 200) return { name: 'Silver', cls: 'level-silver', min: 200 };
  return { name: 'Bronze', cls: 'level-bronze', min: 0 };
}

export function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
export function validatePassword(p) { return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p); }
export function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }
