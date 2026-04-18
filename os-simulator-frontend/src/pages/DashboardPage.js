import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  {
    path: '/processes',
    icon: '⚙',
    title: 'Process & Thread Management',
    desc: 'Simulate process lifecycle, PCB/TCB data structures, state transitions, and thread execution with CPU/IO-bound workloads.',
    color: '#ff8c42',
    dim: 'rgba(255,140,66,0.12)',
    algorithms: ['PCB', 'TCB', 'Lifecycle', 'Threads'],
    badge: 'badge-orange',
  },
  {
    path: '/scheduling',
    icon: '⏱',
    title: 'CPU Scheduling',
    desc: 'Simulate FCFS, SJF, Round Robin & Priority scheduling with interactive Gantt charts and performance metrics.',
    color: '#00c8ff',
    dim: 'rgba(0,200,255,0.12)',
    algorithms: ['FCFS', 'SJF', 'Round Robin', 'Priority'],
    badge: 'badge-cyan',
  },
  {
    path: '/synchronization',
    icon: '⟳',
    title: 'Process Synchronization',
    desc: 'Simulate counting semaphores with detailed thread execution logs and race condition detection.',
    color: '#a78bfa',
    dim: 'rgba(167,139,250,0.12)',
    algorithms: ['Semaphore', 'Race Detect'],
    badge: 'badge-purple',
  },
  {
    path: '/memory',
    icon: '◈',
    title: 'Memory Management',
    desc: 'Simulate paging-based memory systems with FIFO, LRU, and Optimal page replacement, frame visualization.',
    color: '#00ffa3',
    dim: 'rgba(0,255,163,0.12)',
    algorithms: ['FIFO', 'LRU', 'Optimal'],
    badge: 'badge-green',
  },
];

const STATS = [
  { label: 'Scheduling Algorithms', value: '4', color: '#00c8ff' },
  { label: 'Memory Algorithms', value: '3', color: '#00ffa3' },
  { label: 'Sync Primitives', value: '2', color: '#a78bfa' },
  { label: 'OS Modules', value: '4', color: '#ff8c42' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src="/logo.png" alt="logo" style={{ width: 56, height: 56, borderRadius: 14, border: '2px solid rgba(0,200,255,0.25)', boxShadow: '0 0 20px rgba(0,200,255,0.2)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-green" style={{ fontSize: 9 }}>● ONLINE</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
              {greeting},{' '}
              <span style={{ color: 'var(--cyan)' }}>{firstName}</span> 👋
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480 }}>
              Your OS Kernel Simulator is ready. Explore all four core subsystems below.
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 16px', textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── OS Module Cards — 2x2 grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32,
      }}>
        {MODULES.map(mod => (
          <Link key={mod.path} to={mod.path} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ height: '100%', cursor: 'pointer', transition: 'all 0.2s ease', borderColor: 'var(--border)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = mod.color;
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 8px 32px ${mod.dim}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 13,
                  background: mod.dim,
                  border: `1px solid ${mod.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: mod.color, flexShrink: 0,
                }}>
                  {mod.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5, lineHeight: 1.3 }}>{mod.title}</h3>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {mod.algorithms.map(a => (
                      <span key={a} className={`badge ${mod.badge}`} style={{ fontSize: 9 }}>{a}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{mod.desc}</p>
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, color: mod.color, fontSize: 13, fontWeight: 600 }}>
                Launch Module <span>→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Bottom row — Features + Quick Actions ── */}
      <div className="grid-2" style={{ gap: 20 }}>

        {/* Key Features */}
        <div className="card">
          <div className="section-title">Simulator Capabilities</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '⚙', text: 'PCB & TCB data structures with full process lifecycle simulation', color: '#ff8c42' },
              { icon: '⏱', text: 'Multiple CPU scheduling algorithms with Gantt chart visualizations', color: '#00c8ff' },
              { icon: '⟳', text: 'Semaphore synchronization with race condition detection', color: '#a78bfa' },
              { icon: '◈', text: 'Paging-based memory management with 3 page replacement policies', color: '#00ffa3' },
              { icon: '📊', text: 'Performance metrics: waiting time, turnaround time, CPU utilization', color: '#ffb700' },
              { icon: '📁', text: 'CSV import/export for process data and simulation results', color: '#00c8ff' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: item.color, fontSize: 14, marginTop: 2, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="section-title">Quick Launch</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODULES.map(mod => (
                <Link
                  key={mod.path}
                  to={mod.path}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', color: mod.color, borderColor: `${mod.color}30` }}
                  onMouseEnter={e => e.currentTarget.style.background = mod.dim}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>{mod.icon}</span> {mod.title}
                </Link>
              ))}
              <Link to="/results" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                <span>💾</span> View Saved Results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
