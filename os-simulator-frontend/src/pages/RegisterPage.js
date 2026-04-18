import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type={type} className="form-input" placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        required
        autoFocus={key === 'name'}
      />
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: '-10%', right: '-10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(0,255,163,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,200,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo.png"
            alt="OS Kernel Simulator"
            style={{
              width: 88, height: 88, borderRadius: 22,
              margin: '0 auto 18px',
              display: 'block',
              boxShadow: '0 0 40px rgba(0,255,163,0.25)',
              border: '2px solid rgba(0,255,163,0.2)',
            }}
          />
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Join the OS Kernel Simulator platform
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {field('name', 'Full Name', 'text', 'Your full name')}
            {field('email', 'Email Address', 'email', 'you@example.com')}
            {field('password', 'Password', 'password', 'Min. 6 characters')}
            {field('confirm', 'Confirm Password', 'password', 'Repeat your password')}

            <button
              type="submit"
              className="btn btn-success btn-lg"
              disabled={loading}
              style={{ marginTop: 6, justifyContent: 'center' }}
            >
              {loading
                ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Creating account...</>
                : '→ Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
