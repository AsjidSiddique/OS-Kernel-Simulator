import React, { useState } from 'react';
import api from '../utils/api';
import { exportSyncResults } from '../utils/export';

const THREAD_COLORS = ['var(--cyan)','var(--green)','var(--amber)','var(--purple)','var(--red)','#ff6b9d'];

function getThreadColor(thread) {
  const match = thread?.match(/(\d+)$/);
  const idx = match ? (parseInt(match[1]) - 1) : 0;
  return THREAD_COLORS[idx % THREAD_COLORS.length];
}

function getEventBadge(event) {
  if (event.includes('ACQUIRED') || event.includes('entering')) return 'badge-green';
  if (event.includes('RELEASED') || event.includes('exiting')) return 'badge-cyan';
  if (event.includes('WAITING') || event.includes('BLOCKED')) return 'badge-red';
  if (event.includes('executing') || event.includes('critical section')) return 'badge-amber';
  return 'badge-purple';
}

export default function SynchronizationPage() {
  const [primitive, setPrimitive] = useState('Semaphore');
  const [semaphoreType, setSemaphoreType] = useState('counting'); // 'counting' | 'binary'
  const [threadCount, setThreadCount] = useState(3);
  const [iterations, setIterations] = useState(3);
  const [semaphoreValue, setSemaphoreValue] = useState(2);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [filter, setFilter] = useState('ALL');

  const runSimulation = async () => {
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await api.post('/simulate/sync', {
        primitive, threadCount: Number(threadCount),
        iterations: Number(iterations),
        semaphoreValue: Number(semaphoreValue),
        semaphoreType,
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed. Is the backend running?');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post('/simulate/results', {
        title: saveTitle || `Sync — ${primitive} — ${new Date().toLocaleString()}`,
        synchronization: result,
      });
      setSaved(true); setShowSave(false);
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const threads = result ? [...new Set(result.log.map(e => e.thread))].sort() : [];

  const filteredLog = result?.log.filter(e => {
    if (filter === 'ALL') return true;
    return e.thread === filter;
  }) || [];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24, color: 'var(--purple)' }}>⟳</span>
          <h1>Process Synchronization</h1>
          <span className="badge badge-purple">Semaphore</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Simulate counting semaphores with race condition detection and thread execution logs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="section-title">Semaphore Config</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>

              {/* Semaphore Type Toggle */}
              <div style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Semaphore Type</label>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(167,139,250,0.3)' }}>
                  {[
                    { id: 'counting', label: 'Counting', desc: 'N concurrent' },
                    { id: 'binary',   label: 'Binary',   desc: '0 or 1' },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => {
                      setSemaphoreType(opt.id);
                      if (opt.id === 'binary') setSemaphoreValue(1);
                    }} style={{
                      flex: 1, padding: '8px 10px', border: 'none', cursor: 'pointer',
                      background: semaphoreType === opt.id ? 'var(--purple-dim)' : 'rgba(255,255,255,0.03)',
                      color: semaphoreType === opt.id ? 'var(--purple)' : 'var(--text-secondary)',
                      fontWeight: semaphoreType === opt.id ? 700 : 400,
                      fontSize: 12, transition: 'all 0.2s',
                      borderRight: opt.id === 'counting' ? '1px solid rgba(167,139,250,0.3)' : 'none',
                    }}>
                      <div>{opt.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Thread Count</label>
                <input type="number" className="form-input" min={2} max={8} value={threadCount} onChange={e => setThreadCount(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Iterations</label>
                <input type="number" className="form-input" min={1} max={10} value={iterations} onChange={e => setIterations(e.target.value)} />
              </div>
              {semaphoreType === 'counting' && (
                <div className="form-group">
                  <label className="form-label">Semaphore Value (max concurrent)</label>
                  <input type="number" className="form-input" min={1} max={threadCount} value={semaphoreValue} onChange={e => setSemaphoreValue(e.target.value)} />
                </div>
              )}
              {semaphoreType === 'binary' && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Binary semaphore value is fixed at <strong style={{ color: 'var(--purple)' }}>1</strong> — only 0 or 1 allowed (mutual exclusion).
                </div>
              )}
            </div>

            <button className="btn btn-purple" style={{ width: '100%', justifyContent: 'center', background: 'var(--purple-dim)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.3)' }} onClick={runSimulation} disabled={loading}>
              {loading ? <><div className="spinner" style={{ borderTopColor: 'var(--purple)', borderColor: 'rgba(167,139,250,0.2)' }} /> Running...</> : '▶ Run Simulation'}
            </button>

            {result && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSaveTitle(''); setShowSave(true); }}>💾 Save</button>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => exportSyncResults(result)}>⬇ Export</button>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="card" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div className="section-title">How it works</div>
            {semaphoreType === 'counting' ? (
              <>
                <p><strong style={{ color: 'var(--purple)' }}>Counting Semaphore</strong> — integer value ranges over an unrestricted domain. Allows up to <em>N threads</em> concurrently (N = semaphore value).</p>
              </>
            ) : (
              <>
                <p><strong style={{ color: 'var(--purple)' }}>Binary Semaphore</strong> — integer value ranges only between <em>0</em> and <em>1</em>. Only 1 thread at a time (mutual exclusion, like a mutex).</p>
              </>
            )}
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(167,139,250,0.06)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.15)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.9 }}>
              <div style={{ color: 'var(--purple)', fontWeight: 700, marginBottom: 4 }}>wait(S):</div>
              <div>&nbsp;&nbsp;S→value--;</div>
              <div>&nbsp;&nbsp;if (S→value {'<'} 0) {'{'}</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;add process to S→list;</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;block();</div>
              <div>&nbsp;&nbsp;{'}'}</div>
              <div style={{ color: 'var(--purple)', fontWeight: 700, margin: '8px 0 4px' }}>signal(S):</div>
              <div>&nbsp;&nbsp;S→value++;</div>
              <div>&nbsp;&nbsp;if (S→value {'<='} 0) {'{'}</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;remove process P from S→list;</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;wakeup(P);</div>
              <div>&nbsp;&nbsp;{'}'}</div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}
          {saved && <div className="alert alert-success"><span>✓</span> Saved successfully!</div>}

          {result && (
            <>
              {/* Summary Cards */}
              <div className="metric-grid">
                {[
                  { label: 'Type', value: result.semaphoreType === 'binary' ? 'Binary' : 'Counting', color: 'var(--purple)' },
                  { label: 'Primitive', value: 'Semaphore', color: 'var(--cyan)' },
                  { label: 'Threads', value: result.threadCount, color: 'var(--cyan)' },
                  { label: 'Iterations', value: result.iterations, color: 'var(--green)' },
                  { label: 'Log Events', value: result.log.length, color: 'var(--amber)' },
                  { label: 'Blocked/Waited', value: result.racesDetected, color: result.racesDetected > 0 ? 'var(--amber)' : 'var(--green)' },
                  { label: 'Deadlock', value: result.deadlockDetected ? 'YES' : 'NO', color: result.deadlockDetected ? 'var(--red)' : 'var(--green)' },
                ].map(m => (
                  <div key={m.label} className="metric-card">
                    <div className="metric-value" style={{ color: m.color, fontSize: m.value?.toString().length > 6 ? 16 : 22 }}>{m.value}</div>
                    <div className="metric-label">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Thread Timeline */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>Execution Log</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['ALL', ...threads].map(f => (
                      <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: filter === f ? 'var(--purple-dim)' : 'transparent',
                        border: `1px solid ${filter === f ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`,
                        color: filter === f ? 'var(--purple)' : 'var(--text-secondary)',
                        borderRadius: 6,
                      }}>{f}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 480, overflowY: 'auto' }}>
                  {filteredLog.map((entry, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', minWidth: 36 }}>t={entry.time}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: getThreadColor(entry.thread), minWidth: 76 }}>
                        {entry.thread}
                      </span>
                      <span className={`badge ${getEventBadge(entry.event)}`} style={{ fontSize: 9, flexShrink: 0 }}>
                        {entry.state || 'EVENT'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{entry.event}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{entry.resource}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Dialog */}
              {showSave && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                  <div className="card" style={{ width: 380, padding: 28 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Save Simulation</h3>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                      <label className="form-label">Title (optional)</label>
                      <input type="text" className="form-input" placeholder={`Sync — ${primitive} — ${new Date().toLocaleString()}`} value={saveTitle} onChange={e => setSaveTitle(e.target.value)} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '💾 Save'}</button>
                      <button className="btn btn-secondary" onClick={() => setShowSave(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⟳</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to Simulate</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Configure and click <strong>Run Simulation</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
