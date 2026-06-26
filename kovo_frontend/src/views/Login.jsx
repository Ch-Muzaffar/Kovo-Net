import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { validateEmail } from '../utils/helpers';

const REMEMBER_KEY = 'kovo_remember_email';

const stats = [
  { icon: 'lucide:users', value: '12,400+', label: 'Active Members' },
  { icon: 'lucide:message-circle', value: '89,000+', label: 'Problems Solved' },
  { icon: 'lucide:trophy', value: '340+', label: 'Expert Contributors' },
  { icon: 'lucide:globe', value: '58+', label: 'Countries Represented' },
];

const features = [
  { icon: 'lucide:zap', text: 'Post assignments & get real answers from peers' },
  { icon: 'lucide:paperclip', text: 'Attach files, PDFs, images & code snippets' },
  { icon: 'lucide:award', text: 'Earn points & level up by helping others' },
  { icon: 'lucide:shield-check', text: 'Verified academic & professional community' },
];

export default function Login() {
  const { navigate, login, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill email if previously remembered
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!email) {
      newErrors.email = 'Email address is required.';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!password) newErrors.password = 'Password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password, () => {
        // Persist email if "Remember me" checked
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, email);
          localStorage.setItem('kovo_remember_me', 'true');
        } else {
          localStorage.removeItem(REMEMBER_KEY);
          localStorage.removeItem('kovo_remember_me');
        }
        showToast('Welcome back to KOVO NETWORKS!', 'success');
        navigate('feed');
      });
    } catch (err) {
      const msg = err.message || 'Login failed. Please try again.';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('invalid')) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes('password')) {
        setErrors({ password: msg });
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>

      {/* ── LEFT PANEL: Branding ── */}
      <div className="auth-left-panel" style={{
        flex: '0 0 52%',
        background: 'linear-gradient(145deg, #0c5c57 0%, #0F766E 40%, #0a4a45 70%, #083d39 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 3.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(217,167,82,0.08)', top: '-120px', right: '-80px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(6,182,212,0.06)', bottom: '-80px', left: '-60px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.015\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <button
            onClick={() => navigate('landing')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '3rem', padding: 0 }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900,
              fontSize: '1rem', color: '#fff', letterSpacing: '-0.02em',
            }}>KO</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.25rem', color: '#fff', letterSpacing: '0.02em' }}>
              KOVO NETWORKS
            </span>
          </button>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '2.4rem', color: '#fff', lineHeight: 1.15, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Where Problems<br />
            <span style={{ color: '#D9A752' }}>Find Solutions.</span>
          </h1>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, marginBottom: '2.5rem', maxWidth: '420px' }}>
            A professional knowledge-sharing platform connecting students and experts across 58+ countries. Post your challenges, get verified answers.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.75rem' }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon icon={f.icon} style={{ fontSize: '0.9rem', color: '#D9A752' }} />
                </div>
                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px',
                padding: '0.875rem 1rem',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon icon={s.icon} style={{ fontSize: '0.875rem', color: '#D9A752' }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{s.value}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 2rem',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }} className="page-enter">

          {/* Mobile logo (only shows when left panel is hidden) */}
          <button
            className="auth-mobile-logo"
            onClick={() => navigate('landing')}
            style={{ display: 'none', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '2rem', padding: 0 }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--gradient-btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '0.8rem', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>KO</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>KOVO NETWORKS</span>
          </button>

          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Welcome back 👋
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Sign in to continue to KOVO NETWORKS
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }} htmlFor="login-email">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: null })); }}
                  required
                />
                <p className={`error-text ${errors.email ? 'visible' : ''}`}>{errors.email}</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }} htmlFor="login-pass">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-pass"
                    type={showPassword ? 'text' : 'password'}
                    className={`input-field ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: null })); }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    aria-label="Toggle password visibility"
                  >
                    <Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} style={{ fontSize: '1.1rem' }} />
                  </button>
                </div>
                <p className={`error-text ${errors.password ? 'visible' : ''}`}>{errors.password}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password reset link sent to email.', 'info')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8125rem', color: 'var(--accent-purple)', fontWeight: 500 }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="btn-gradient"
                style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.01em' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><div className="spinner-sm" /> Signing in...</>
                ) : (
                  <><Icon icon="lucide:log-in" style={{ fontSize: '1rem' }} /> Sign In</>
                )}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
            Don't have an account?{' '}
            <button
              onClick={() => navigate('register')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Create one free →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
