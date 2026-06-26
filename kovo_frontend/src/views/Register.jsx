import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { validateEmail, validatePassword } from '../utils/helpers';

const stats = [
  { icon: 'lucide:users', value: '12,400+', label: 'Active Members' },
  { icon: 'lucide:message-circle', value: '89,000+', label: 'Problems Solved' },
  { icon: 'lucide:trophy', value: '340+', label: 'Expert Contributors' },
  { icon: 'lucide:globe', value: '58+', label: 'Countries' },
];

export default function Register() {
  const { navigate, showToast, register } = useApp();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dob: '',
    country: '', city: '', profession: '',
    userType: 'student', acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { n: 1, label: 'Credentials' },
    { n: 2, label: 'About You' },
    { n: 3, label: 'Confirm' },
  ];

  const handleNextStep = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (step === 1) {
      if (!form.email) newErrors.email = 'Email is required.';
      else if (!validateEmail(form.email)) newErrors.email = 'Enter a valid email.';
      if (!form.password) {
        newErrors.password = 'Password is required.';
      } else if (form.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long.';
      }
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
      if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
      setStep(2);
    } else if (step === 2) {
      if (!form.firstName) newErrors.firstName = 'First name is required.';
      if (!form.lastName) newErrors.lastName = 'Last name is required.';
      if (!form.dob) {
        newErrors.dob = 'Date of birth is required.';
      } else {
        const bd = new Date(form.dob), today = new Date();
        let age = today.getFullYear() - bd.getFullYear();
        const m = today.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
        if (isNaN(bd.getTime())) newErrors.dob = 'Enter a valid date.';
        else if (age < 13) newErrors.dob = 'Must be at least 13 years old.';
        else if (age > 120) newErrors.dob = 'Enter a valid date.';
      }
      if (!form.country) newErrors.country = 'Country is required.';
      if (!form.city) newErrors.city = 'City is required.';
      if (!form.profession) newErrors.profession = 'Profession is required.';
      if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
      setStep(3);
    } else if (step === 3) {
      if (!form.acceptTerms) { setErrors({ acceptTerms: 'You must accept the terms.' }); return; }
      setIsSubmitting(true);
      try {
        await register(form, () => {
          localStorage.setItem('kovo_remember_me', 'true');
          showToast('Welcome to KOVO NETWORKS!', 'success');
          navigate('feed');
        });
      } catch (err) {
        const msg = err.message || 'Registration failed.';
        if (msg.toLowerCase().includes('email')) { setStep(1); setErrors({ email: msg }); }
        else showToast(msg, 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBackStep = () => { if (step > 1) { setStep(step - 1); setErrors({}); } };
  const field = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const clearErr = (key) => setErrors(p => ({ ...p, [key]: null }));

  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: '', color: 'var(--border-color)', bars: 0 };
    if (p.length < 8) return { score: 1, label: 'Too short (min 8 characters)', color: '#EF4444', bars: 1 };

    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSymbol = /[^A-Za-z0-9]/.test(p);

    const count = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

    if (count === 4) {
      return { score: 3, label: 'Strong', color: '#10B981', bars: 3 };
    } else if (count >= 2) {
      return { score: 2, label: 'Medium', color: '#F59E0B', bars: 2 };
    } else {
      return { score: 1, label: 'Weak', color: '#EF4444', bars: 1 };
    }
  };

  const strength = getPasswordStrength();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>

      {/* LEFT PANEL */}
      <div className="auth-left-panel" style={{
        flex: '0 0 45%', background: 'linear-gradient(145deg,#0c5c57 0%,#0F766E 40%,#0a4a45 70%,#083d39 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem 3rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(217,167,82,0.08)', top: '-100px', right: '-60px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(6,182,212,0.06)', bottom: '-60px', left: '-40px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <button onClick={() => navigate('landing')} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '2.5rem', padding: 0 }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>KO</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>KOVO NETWORKS</span>
          </button>

          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '2.1rem', color: '#fff', lineHeight: 1.2, marginBottom: '0.875rem', letterSpacing: '-0.02em' }}>
            Join the Network.<br /><span style={{ color: '#D9A752' }}>Grow Together.</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: '2rem', maxWidth: '380px' }}>
            Connect with 12,000+ students and professionals. Share knowledge, solve problems, and build your academic reputation.
          </p>

          {/* Steps preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2.25rem' }}>
            {[
              { n: 1, label: 'Create credentials', icon: 'lucide:key-round' },
              { n: 2, label: 'Tell us about yourself', icon: 'lucide:user-circle' },
              { n: 3, label: 'Agree & join', icon: 'lucide:shield-check' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === s.n ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: step === s.n ? 'rgba(217,167,82,0.25)' : 'rgba(255,255,255,0.08)', border: step > s.n ? '1.5px solid #D9A752' : '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step > s.n
                    ? <Icon icon="lucide:check" style={{ fontSize: '0.8rem', color: '#D9A752' }} />
                    : <Icon icon={s.icon} style={{ fontSize: '0.8rem', color: step === s.n ? '#D9A752' : 'rgba(255,255,255,0.6)' }} />}
                </div>
                <span style={{ fontSize: '0.82rem', color: step === s.n ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: step === s.n ? 600 : 400 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 0.875rem', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                  <Icon icon={s.icon} style={{ fontSize: '0.8rem', color: '#D9A752' }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{s.value}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.75rem', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '440px' }} className="page-enter">

          {/* Mobile logo */}
          <button className="auth-mobile-logo" onClick={() => navigate('landing')}
            style={{ display: 'none', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.75rem', padding: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--gradient-btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '0.75rem', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>KO</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>KOVO NETWORKS</span>
          </button>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Create your account
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Step {step} of 3 — {steps[step - 1].label}</p>
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.5rem' }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div style={{ flex: 1, height: '2px', background: step > s.n ? 'var(--success)' : 'var(--border-color)', transition: 'background 0.3s' }} />}
                <div className={`step-dot ${step === s.n ? 'active' : ''} ${step > s.n ? 'completed' : ''}`} aria-label={`Step ${s.n}`} style={{ fontSize: '0.75rem' }}>
                  {step > s.n ? <Icon icon="lucide:check" style={{ fontSize: '0.8rem' }} /> : s.n}
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <form onSubmit={handleNextStep} noValidate>

              {/* STEP 1 */}
              {step === 1 && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-email">Email Address</label>
                    <input id="reg-email" type="email" className={`input-field ${errors.email ? 'error' : ''}`} placeholder="you@example.com"
                      value={form.email} onChange={e => { field('email', e.target.value); clearErr('email'); }} autoComplete="email" required />
                    <p className={`error-text ${errors.email ? 'visible' : ''}`}>{errors.email}</p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-pass">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="reg-pass" type={showPassword ? 'text' : 'password'} className={`input-field ${errors.password ? 'error' : ''}`} placeholder="Min 8 characters"
                        value={form.password} onChange={e => { field('password', e.target.value); clearErr('password'); }} autoComplete="new-password" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} aria-label="Toggle password">
                        <Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} style={{ fontSize: '1.1rem' }} />
                      </button>
                    </div>
                    {form.password && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                          {[1, 2, 3].map(i => (
                            <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: strength.bars >= i ? strength.color : 'var(--border-color)', transition: 'background 0.3s' }} />
                          ))}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: strength.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Password strength: {strength.label}
                        </div>
                      </div>
                    )}
                    <p className={`error-text ${errors.password ? 'visible' : ''}`}>{errors.password}</p>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-confirm">Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="reg-confirm" type={showConfirmPassword ? 'text' : 'password'} className={`input-field ${errors.confirmPassword ? 'error' : ''}`} placeholder="Re-enter your password"
                        value={form.confirmPassword} onChange={e => { field('confirmPassword', e.target.value); clearErr('confirmPassword'); }} autoComplete="new-password" required />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} aria-label="Toggle confirm password">
                        <Icon icon={showConfirmPassword ? 'lucide:eye-off' : 'lucide:eye'} style={{ fontSize: '1.1rem' }} />
                      </button>
                    </div>
                    <p className={`error-text ${errors.confirmPassword ? 'visible' : ''}`}>{errors.confirmPassword}</p>
                  </div>
                  <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '0.78rem', fontSize: '0.9rem', fontWeight: 700 }}>Continue →</button>
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-fname">First Name</label>
                      <input id="reg-fname" type="text" className={`input-field ${errors.firstName ? 'error' : ''}`} placeholder="John"
                        value={form.firstName} onChange={e => { field('firstName', e.target.value); clearErr('firstName'); }} required />
                      <p className={`error-text ${errors.firstName ? 'visible' : ''}`}>{errors.firstName}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-lname">Last Name</label>
                      <input id="reg-lname" type="text" className={`input-field ${errors.lastName ? 'error' : ''}`} placeholder="Doe"
                        value={form.lastName} onChange={e => { field('lastName', e.target.value); clearErr('lastName'); }} required />
                      <p className={`error-text ${errors.lastName ? 'visible' : ''}`}>{errors.lastName}</p>
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-dob">Date of Birth</label>
                    <input id="reg-dob" type="date" className={`input-field ${errors.dob ? 'error' : ''}`}
                      value={form.dob} onChange={e => { field('dob', e.target.value); clearErr('dob'); }} required />
                    <p className={`error-text ${errors.dob ? 'visible' : ''}`}>{errors.dob}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-country">Country</label>
                      <input id="reg-country" type="text" className={`input-field ${errors.country ? 'error' : ''}`} placeholder="Pakistan"
                        value={form.country} onChange={e => { field('country', e.target.value); clearErr('country'); }} required />
                      <p className={`error-text ${errors.country ? 'visible' : ''}`}>{errors.country}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-city">City</label>
                      <input id="reg-city" type="text" className={`input-field ${errors.city ? 'error' : ''}`} placeholder="Lahore"
                        value={form.city} onChange={e => { field('city', e.target.value); clearErr('city'); }} required />
                      <p className={`error-text ${errors.city ? 'visible' : ''}`}>{errors.city}</p>
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }} htmlFor="reg-prof">Profession / Field</label>
                    <input id="reg-prof" type="text" className={`input-field ${errors.profession ? 'error' : ''}`} placeholder="e.g. Computer Science"
                      value={form.profession} onChange={e => { field('profession', e.target.value); clearErr('profession'); }} required />
                    <p className={`error-text ${errors.profession ? 'visible' : ''}`}>{errors.profession}</p>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>I am a</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                      {[{ v: 'student', icon: 'lucide:graduation-cap', label: 'Student' }, { v: 'professional', icon: 'lucide:briefcase', label: 'Professional' }].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => field('userType', opt.v)}
                          style={{ padding: '0.65rem', borderRadius: '10px', border: `1.5px solid ${form.userType === opt.v ? 'var(--accent-purple)' : 'var(--border-color)'}`, background: form.userType === opt.v ? 'rgba(15,118,110,0.06)' : 'transparent', color: form.userType === opt.v ? 'var(--accent-purple)' : 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                          <Icon icon={opt.icon} style={{ fontSize: '1.15rem' }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button type="button" className="btn-ghost" style={{ flex: 1, padding: '0.75rem', fontSize: '0.875rem' }} onClick={handleBackStep}>← Back</button>
                    <button type="submit" className="btn-gradient" style={{ flex: 2, padding: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Continue →</button>
                  </div>
                </>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <>
                  <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.1)' }}>
                      <Icon icon="lucide:shield-check" style={{ fontSize: '1.75rem', color: 'var(--success)' }} />
                    </div>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Almost there!</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {[
                      'Post assignments & get community help',
                      'Attach files, PDFs, images & code',
                      'Mark helpful answers to reward contributors',
                      'Level up your profile by being helpful',
                    ].map((txt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.02)' }}>
                        <Icon icon="lucide:check-circle-2" style={{ fontSize: '0.95rem', color: 'var(--accent-purple)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{txt}</span>
                      </div>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${errors.acceptTerms ? 'var(--error)' : 'var(--border-color)'}`, background: 'rgba(15,23,42,0.02)', marginBottom: '0.5rem' }}>
                    <input type="checkbox" checked={form.acceptTerms} onChange={e => { field('acceptTerms', e.target.checked); clearErr('acceptTerms'); }}
                      style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: 'var(--accent-purple)', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      I agree to the <span style={{ color: 'var(--accent-purple)' }}>Terms of Service</span> and <span style={{ color: 'var(--accent-purple)' }}>Privacy Policy</span>
                    </span>
                  </label>
                  <p className={`error-text ${errors.acceptTerms ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: '1rem' }}>{errors.acceptTerms}</p>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button type="button" className="btn-ghost" style={{ flex: 1, padding: '0.75rem', fontSize: '0.875rem' }} onClick={handleBackStep}>← Back</button>
                    <button type="submit" className="btn-gradient" style={{ flex: 2, padding: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} disabled={isSubmitting}>
                      {isSubmitting ? <><div className="spinner-sm" /> Creating...</> : 'Create Account 🎉'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
            Already have an account?{' '}
            <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.875rem' }}>
              Sign in →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
