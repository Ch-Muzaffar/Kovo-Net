import React from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';

export default function Landing() {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="gradient-orb" style={{ width: '600px', height: '600px', background: 'radial-gradient(circle,rgba(15,118,110,0.15),transparent)', top: '-200px', right: '-200px' }}></div>
      <div className="gradient-orb" style={{ width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(217,167,82,0.15),transparent)', bottom: '10%', left: '-100px' }}></div>
      <div className="gradient-orb" style={{ width: '300px', height: '300px', background: 'radial-gradient(circle,rgba(6,182,212,0.15),transparent)', top: '40%', right: '10%' }}></div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 flex items-center px-6 lg:px-10" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-extrabold text-white text-sm" style={{ background: 'var(--gradient-btn)' }}>KO</div>
            <span className="font-display font-bold text-lg text-[var(--text-primary)]">KOVO NETWORKS</span>
          </div>
          <div className="hidden md:flex nav-pill-container">
            <a href="#features" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">Features</a>
            <a href="#how-it-works" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">How It Works</a>
            <a href="#community" className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 transition-all">Community</a>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-glass-secondary px-5 py-2 text-sm" onClick={() => navigate('login')}>Sign In</button>
            <button className="btn-glass-primary px-5 py-2.5 text-sm" onClick={() => navigate('register')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto w-full text-center">
          <div className="page-enter flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)', color: 'var(--accent-purple)' }}>
              <Icon icon="lucide:sparkles" style={{ fontSize: '0.875rem' }} />
              Human-First Knowledge Network
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.05] tracking-tight mb-6">
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
                <Icon icon="lucide:play-circle" style={{ fontSize: '1.25rem' }} />
                See How It Works
              </button>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 mt-10 pt-8 border-t border-[var(--border-color)] w-full">
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
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Not another AI chatbot. KOVO NETWORKS connects you with real human expertise across every discipline.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'lucide:target', title: 'Targeted Help', desc: 'Tag specific departments, skills, or people. Your problem reaches exactly who can help.' },
              { icon: 'lucide:layers', title: 'Smart Feed', desc: '70% matched to your expertise, 30% cross-disciplinary discovery for unexpected insights.' },
              { icon: 'lucide:upload', title: 'Rich Attachments', desc: 'Share PDFs, images, code snippets, and compressed files with your posts.' },
              { icon: 'lucide:trophy', title: 'Gamified Reputation', desc: 'Earn points for helpful contributions. Level up and build recognized expertise.' },
              { icon: 'lucide:shield-check', title: 'Safe Community', desc: 'Automated screening, community flagging, and transparent moderation.' },
              { icon: 'lucide:message-square', title: 'Private Collaboration', desc: 'Shift from public comments to private DMs for deeper one-on-one collaboration.' },
            ].map((f, i) => (
              <div key={i} className="card p-6 group hover:border-[rgba(15,118,110,0.25)] page-enter" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: 'rgba(15,118,110,0.08)' }}>
                  <Icon icon={f.icon} className="text-[var(--accent-purple)]" style={{ fontSize: '1.5rem' }} />
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
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--text-primary)] mb-4">How KOVO NETWORKS Works</h2>
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-white text-xs" style={{ background: 'var(--gradient-btn)' }}>KO</div>
            <span className="font-display font-bold text-sm text-[var(--text-primary)]">KOVO NETWORKS</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 KOVO NETWORKS. You Are Not Alone.</p>
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
