import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';

/* ── Brand lockup: "KOVO" big, "NETWORKS" small below ── */
function KovoBrand({ light = false, size = 'md' }) {
  const sizes = {
    sm:  { kovo: '1.05rem', net: '0.52rem', gap: '1px' },
    md:  { kovo: '1.35rem', net: '0.65rem', gap: '1px' },
    lg:  { kovo: '1.75rem', net: '0.82rem', gap: '2px' },
    xl:  { kovo: '2.5rem',  net: '1.15rem', gap: '2px' },
  };
  const s = sizes[size] || sizes.md;
  const color = light ? '#ffffff' : 'var(--text-primary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: s.gap, lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 900,
        fontSize: s.kovo,
        color,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>KOVO</span>
      <span style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 700,
        fontSize: s.net,
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
        letterSpacing: '0.08em',
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>NET</span>
    </div>
  );
}

export default function Landing() {
  const { navigate, darkMode, toggleDarkMode } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="gradient-orb" style={{ width: '600px', height: '600px', background: 'radial-gradient(circle,rgba(15,118,110,0.15),transparent)', top: '-200px', right: '-200px' }}></div>
      <div className="gradient-orb" style={{ width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(217,167,82,0.15),transparent)', bottom: '10%', left: '-100px' }}></div>
      <div className="gradient-orb" style={{ width: '300px', height: '300px', background: 'radial-gradient(circle,rgba(6,182,212,0.15),transparent)', top: '40%', right: '10%' }}></div>

      {/* ── NAV ── */}
      <nav
        className="landing-nav fixed z-50 flex items-center px-4"
        style={{
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: '960px',
          height: '52px',
          borderRadius: '9999px',
          background: 'var(--bg-glass-nav)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 4px 24px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        }}
      >
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>

          {/* Logo */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', padding: '0' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="KOVO Net home"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-white text-xs flex-shrink-0" style={{ background: 'var(--gradient-btn)', minWidth: '32px', minHeight: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '0.7rem' }}>KN</div>
            <KovoBrand size="sm" />
          </button>

          {/* Desktop center links */}
          <div className="desktop-only-flex nav-pill-container">
            <a href="#features" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">Features</a>
            <a href="#how-it-works" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">How It Works</a>
            <a href="#community" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">Community</a>
          </div>

          {/* Desktop right buttons */}
          <div className="desktop-only-flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={darkMode}
              style={{
                background: 'none', border: '1px solid var(--border-color)',
                cursor: 'pointer', borderRadius: '10px', padding: '7px',
                display: 'flex', alignItems: 'center',
                color: darkMode ? '#E5B82A' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <Icon icon={darkMode ? 'solar:sun-bold-duotone' : 'solar:moon-stars-bold-duotone'} style={{ fontSize: '1.1rem' }} />
            </button>
            <button className="btn-glass-secondary px-4 py-1.5 text-sm" onClick={() => navigate('login')}>Sign In</button>
            <button className="btn-glass-primary px-4 py-2 text-sm" onClick={() => navigate('register')}>Get Started</button>
          </div>

          {/* Mobile hamburger — only shown on small screens */}
          <div className="mobile-only-flex items-center gap-1" ref={menuRef} style={{ position: 'relative' }}>
            {/* Hamburger button */}
            <button
              id="landing-menu-btn"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              style={{
                background: menuOpen ? 'rgba(15,118,110,0.10)' : 'none',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                borderRadius: '10px',
                padding: '7px 9px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <Icon icon={menuOpen ? 'solar:close-circle-bold-duotone' : 'solar:menu-hamburger-bold-duotone'} style={{ fontSize: '1.25rem' }} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: '0',
                  minWidth: '200px',
                  background: 'var(--bg-glass-nav)',
                  backdropFilter: 'blur(24px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '18px',
                  boxShadow: '0 12px 40px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.2)',
                  padding: '8px',
                  zIndex: 10000,
                  animation: 'slideDown 0.2s cubic-bezier(0.16,1,0.3,1) both',
                }}
              >
                {/* Section links */}
                <a
                  href="#features"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)',
                    textDecoration: 'none', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,118,110,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:bolt-bold-duotone" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }} />
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)',
                    textDecoration: 'none', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,118,110,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:layers-bold-duotone" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }} />
                  How It Works
                </a>
                <a
                  href="#community"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)',
                    textDecoration: 'none', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,118,110,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }} />
                  Community
                </a>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '6px 8px' }} />

                {/* Auth buttons */}
                <button
                  onClick={() => { navigate('login'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '10px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,118,110,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:login-3-bold-duotone" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }} />
                  Sign In
                </button>
                <button
                  onClick={() => { navigate('register'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '11px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                    background: 'var(--gradient-btn)', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.18s',
                    boxShadow: '0 4px 16px rgba(15,118,110,0.2)',
                  }}
                >
                  <Icon icon="solar:stars-bold-duotone" style={{ fontSize: '1.2rem' }} />
                  Get Started Free
                </button>

                {/* Theme toggle in dropdown */}
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '6px 8px' }} />
                <button
                  onClick={() => { toggleDarkMode(); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '10px 14px', borderRadius: '12px',
                    fontSize: '0.875rem', fontWeight: 600,
                    color: darkMode ? '#E5B82A' : 'var(--text-secondary)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,160,23,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon
                    icon={darkMode ? 'solar:sun-bold-duotone' : 'solar:moon-stars-bold-duotone'}
                    style={{ fontSize: '1.2rem', color: darkMode ? '#E5B82A' : 'var(--accent-purple)' }}
                  />
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center pb-20 px-6" style={{ paddingTop: 'clamp(90px, 22vw, 140px)' }}>
        <div className="max-w-4xl mx-auto w-full text-center">
          <div className="page-enter flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)', color: 'var(--accent-purple)' }}>
              <Icon icon="solar:stars-bold-duotone" style={{ fontSize: '0.9rem' }} />
              Human-First Knowledge Network
            </div>
            <h1 className="font-display font-extrabold leading-[1.05] tracking-tight mb-6" style={{ fontSize: 'clamp(2.25rem, 8vw, 4.5rem)' }}>
              <span className="text-[var(--text-primary)]">YOU ARE</span><br />
              <span className="gradient-text-full">NOT ALONE</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-8 max-w-2xl mx-auto">
              Where AI falls short, real people step in. Post your toughest problems, get genuine human insights from students and professionals worldwide.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="btn-glass-primary px-8 py-3.5 text-base font-semibold" onClick={() => navigate('register')}>Join the Network</button>
              <button
                className="btn-glass-secondary px-6 py-3.5 text-base flex items-center gap-2"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Icon icon="solar:play-circle-bold-duotone" style={{ fontSize: '1.4rem' }} />
                See How It Works
              </button>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 mt-10 pt-8 w-full" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent-purple) 30%, var(--accent-blue, #0ea5e9) 70%, transparent)' }} />
              <div><div className="text-2xl font-bold text-[var(--text-primary)]">2.4K+</div><div className="text-xs text-[var(--text-muted)]">Active Members</div></div>
              <div className="w-px h-10 bg-[var(--border-color)]"></div>
              <div><div className="text-2xl font-bold text-[var(--text-primary)]">8.5K+</div><div className="text-xs text-[var(--text-muted)]">Problems Solved</div></div>
              <div className="w-px h-10 bg-[var(--border-color)]"></div>
              <div><div className="text-2xl font-bold text-[var(--text-primary)]">50+</div><div className="text-xs text-[var(--text-muted)]">Departments</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 page-enter">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--text-primary)] mb-4">Built for Real Problem Solving</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Not another AI chatbot. KOVO connects you with real human expertise across every discipline.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'solar:target-bold-duotone', title: 'Targeted Help', desc: 'Tag specific departments, skills, or people. Your problem reaches exactly who can help.' },
              { icon: 'solar:layers-bold-duotone', title: 'Smart Feed', desc: '70% matched to your expertise, 30% cross-disciplinary discovery for unexpected insights.' },
              { icon: 'solar:upload-track-bold-duotone', title: 'Rich Attachments', desc: 'Share PDFs, images, code snippets, and compressed files with your posts.' },
              { icon: 'solar:cup-first-bold-duotone', title: 'Gamified Reputation', desc: 'Earn points for helpful contributions. Level up and build recognized expertise.' },
              { icon: 'solar:shield-check-bold-duotone', title: 'Safe Community', desc: 'Automated screening, community flagging, and transparent moderation.' },
              { icon: 'solar:chat-square-bold-duotone', title: 'Private Collaboration', desc: 'Shift from public comments to private DMs for deeper one-on-one collaboration.' },
            ].map((f, i) => (
              <div key={i} className="card p-6 group hover:border-[rgba(15,118,110,0.25)] page-enter" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: 'rgba(15,118,110,0.08)' }}>
                  <Icon icon={f.icon} className="text-[var(--accent-purple)]" style={{ fontSize: '1.65rem' }} />
                </div>
                <h3 className="font-display font-bold text-[var(--text-primary)] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--text-primary)] mb-4">How KOVO Works</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Three simple steps to get the help you need from real people.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Post Your Problem', desc: 'Describe your challenge, attach files, and tag relevant departments or skills.' },
              { step: '02', title: 'Get Human Responses', desc: 'Real students and professionals share ideas, feedback, and solutions.' },
              { step: '03', title: 'Mark Helpful & Grow', desc: 'Reward the best answers. Helpers earn points and level up their reputation.' },
            ].map((s, i) => (
              <div key={i} className="text-center page-enter" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="text-5xl font-display font-extrabold gradient-text mb-4">{s.step}</div>
                <h3 className="font-display font-bold text-[var(--text-primary)] text-xl mb-3">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="community" className="py-24 px-6 relative overflow-hidden">
        <div className="gradient-orb" style={{ width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(217,167,82,0.08),transparent)', top: '-100px', left: '50%', transform: 'translateX(-50%)' }}></div>
        <div className="max-w-3xl mx-auto text-center relative z-10 page-enter">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-[var(--text-primary)] mb-6 leading-tight">Ready to Solve Problems<br /><span className="gradient-text">Together?</span></h2>
          <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">Join thousands of students and professionals who believe in the power of human collaboration.</p>
          <button className="btn-glass-primary px-10 py-4 text-base font-semibold" onClick={() => navigate('register')}>Create Free Account</button>
          <p className="text-xs text-[var(--text-muted)] mt-4">No credit card required · 100% free forever</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-white text-xs" style={{ background: 'var(--gradient-btn)' }}>KN</div>
            <KovoBrand size="sm" />
          </div>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 KOVO NET. You Are Not Alone.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" aria-label="Twitter"><Icon icon="lucide:twitter" style={{ fontSize: '1.125rem' }} /></a>
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" aria-label="GitHub"><Icon icon="lucide:github" style={{ fontSize: '1.125rem' }} /></a>
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" aria-label="LinkedIn"><Icon icon="lucide:linkedin" style={{ fontSize: '1.125rem' }} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
