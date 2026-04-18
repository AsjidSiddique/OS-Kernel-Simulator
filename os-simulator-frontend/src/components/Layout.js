import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const NAV = [
  { path: '/dashboard',      label: 'Dashboard',          icon: '⊞', color: '#00c8ff' },
  { path: '/processes',      label: 'Process & Threads',  icon: '⚙', color: '#ff8c42' },
  { path: '/scheduling',     label: 'CPU Scheduling',     icon: '⏱', color: '#00c8ff' },
  { path: '/memory',         label: 'Memory Mgmt',        icon: '◈', color: '#00ffa3' },
  { path: '/synchronization',label: 'Synchronization',    icon: '⟳', color: '#a78bfa' },
  { path: '/results',        label: 'Saved Results',      icon: '◉', color: '#ffb700' },
  { path: '/profile',        label: 'Profile',            icon: '◎', color: '#00c8ff' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  // Build avatar URL from avatar object (backend returns { filename, url, ... })
  const avatarUrl = user?.avatar?.url
    ? `${BACKEND}${user.avatar.url}`
    : null;

  const sidebarW = collapsed ? 72 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: sidebarW,
        minWidth: sidebarW,
        maxWidth: sidebarW,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        overflow: 'hidden',
      }}>

        {/* Logo + Collapse Button */}
        <div style={{
          padding: collapsed ? '20px 16px' : '20px 16px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img
            src="/logo.png"
            alt="OS Kernel Simulator"
            style={{
              width: 38, height: 38, borderRadius: 10,
              flexShrink: 0, objectFit: 'cover',
              boxShadow: '0 0 12px rgba(0,200,255,0.3)',
            }}
          />
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>OS Kernel</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>SIMULATOR v2.0</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              marginLeft: 'auto', background: 'rgba(0,200,255,0.06)',
              border: '1px solid var(--border)', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 14, flexShrink: 0,
              padding: '4px 7px', borderRadius: 8, transition: 'all 0.2s',
              lineHeight: 1,
            }}
          >{collapsed ? '›' : '‹'}</button>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ path, label, icon, color }) => (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10, textDecoration: 'none',
                transition: 'all 0.2s',
                background: isActive ? `${color}18` : 'transparent',
                color: isActive ? color : 'var(--text-secondary)',
                border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
              })}
            >
              <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
              {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', marginBottom: 8,
              background: 'rgba(0,200,255,0.04)', borderRadius: 10,
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--purple), var(--cyan))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#000',
                overflow: 'hidden', border: '2px solid rgba(0,200,255,0.25)',
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
                  : (user?.name?.[0]?.toUpperCase() || 'U')}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8, padding: collapsed ? '10px 0' : '9px 12px',
              background: 'transparent', border: '1px solid rgba(255,71,87,0.2)',
              color: 'var(--red)', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 16 }}>⏻</span>
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT — shifts with sidebar ── */}
      <main style={{
        marginLeft: sidebarW,
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.25s ease',
        minWidth: 0,
      }}>
        <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
