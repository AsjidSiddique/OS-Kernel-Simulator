import React, { useState } from 'react';
import api from '../utils/api';

const STATE_COLORS = {
  NEW:        '#7a9ec0',
  READY:      '#ffb700',
  RUNNING:    '#00ffa3',
  WAITING:    '#a78bfa',
  TERMINATED: '#ff4757',
};

const STATE_BG = {
  NEW:        'rgba(122,158,192,0.12)',
  READY:      'rgba(255,183,0,0.12)',
  RUNNING:    'rgba(0,255,163,0.12)',
  WAITING:    'rgba(167,139,250,0.12)',
  TERMINATED: 'rgba(255,71,87,0.12)',
};

const STATE_DESC = {
  NEW:        'Process created',
  READY:      'Waiting for CPU',
  RUNNING:    'Executing on CPU',
  WAITING:    'Blocked on I/O',
  TERMINATED: 'Execution complete',
};

function StateBadge({ state, small }) {
  return (
    <span style={{
      background: STATE_BG[state] || 'rgba(255,255,255,0.08)',
      color: STATE_COLORS[state] || '#fff',
      border: `1px solid ${STATE_COLORS[state] || '#fff'}33`,
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 6,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      fontFamily: 'monospace',
      letterSpacing: 0.3,
    }}>{state}</span>
  );
}

function TransitionRow({ entry }) {
  const isThread = entry.isThread;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 10,
      background: isThread ? 'rgba(167,139,250,0.05)' : 'rgba(255,140,66,0.04)',
      border: `1px solid ${isThread ? 'rgba(167,139,250,0.14)' : 'rgba(255,140,66,0.12)'}`,
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = isThread ? 'rgba(167,139,250,0.10)' : 'rgba(255,140,66,0.09)'}
      onMouseLeave={e => e.currentTarget.style.background = isThread ? 'rgba(167,139,250,0.05)' : 'rgba(255,140,66,0.04)'}
    >
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', minWidth: 34, flexShrink: 0 }}>
        t={entry.time}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: isThread ? '#a78bfa' : '#ff8c42',
        minWidth: 56, fontFamily: 'monospace', flexShrink: 0,
      }}>
        {isThread ? '🧵' : '⚙'} {entry.name}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <StateBadge state={entry.fromState} small />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
        <StateBadge state={entry.toState} small />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, marginLeft: 2 }}>{entry.event}</span>
    </div>
  );
}

export default function ProcessManagementPage() {
  const [processCount, setProcessCount] = useState(4);
  const [includeThreads, setIncludeThreads] = useState(true);
  const [threadsPerProcess, setThreadsPerProcess] = useState(2);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');
  const [filterType, setFilterType] = useState('ALL');

  const runSimulation = async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const res = await api.post('/processes/simulate', {
        processCount: Number(processCount),
        includeThreads,
        threadsPerProcess: Number(threadsPerProcess),
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed. Is the backend running?');
    } finally { setLoading(false); }
  };

  const filteredLog = result?.stateLog?.filter(e =>
    filterType === 'ALL' ? true :
    filterType === 'PROCESS' ? !e.isThread :
    e.isThread
  ) || [];

  const tabs = [
    { id: 'timeline', label: '📋 State Timeline' },
    { id: 'pcb',      label: '🗂 PCB Table' },
    { id: 'workload', label: '📊 Workload' },
  ];

  return (
    <div className="fade-in">

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 26, color: '#ff8c42' }}>⚙</span>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Process & Thread Management</h1>
          <span className="badge badge-orange" style={{ fontSize: 11 }}>PCB / TCB</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Simulate process lifecycle, PCB/TCB structures, state transitions and thread execution with CPU-bound and I/O-bound workloads.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="card">
            <div className="section-title">Simulation Config</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="form-group">
                <label className="form-label">Number of Processes</label>
                <input type="number" className="form-input" min={1} max={8} value={processCount}
                  onChange={e => setProcessCount(e.target.value)} />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10,
                background: 'rgba(255,140,66,0.07)',
                border: '1px solid rgba(255,140,66,0.18)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Include Threads</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Simulate TCB & thread states</div>
                </div>
                <button onClick={() => setIncludeThreads(t => !t)} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: includeThreads ? '#ff8c42' : 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.25s',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: includeThreads ? 23 : 3, transition: 'left 0.25s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>

              {includeThreads && (
                <div className="form-group">
                  <label className="form-label">Threads per Process</label>
                  <input type="number" className="form-input" min={1} max={4} value={threadsPerProcess}
                    onChange={e => setThreadsPerProcess(e.target.value)} />
                </div>
              )}

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
                onClick={runSimulation} disabled={loading}>
                {loading
                  ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Simulating...</>
                  : '⚙ Run Simulation'}
              </button>
            </div>
          </div>

          {/* State Legend */}
          <div className="card">
            <div className="section-title">Process States</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(STATE_COLORS).map(([state, color]) => (
                <div key={state} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8,
                  background: STATE_BG[state],
                  border: `1px solid ${color}22`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>{state}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{STATE_DESC[state]}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '9px 12px', background: 'rgba(0,200,255,0.05)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, border: '1px solid rgba(0,200,255,0.1)' }}>
              <strong style={{ color: '#00c8ff' }}>Transitions:</strong><br />
              NEW → READY → RUNNING → TERMINATED<br />
              RUNNING → WAITING (I/O request)<br />
              WAITING → RUNNING (I/O complete)
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          {result && (
            <>
              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Processes',         value: result.metrics.totalProcesses,                    color: '#ff8c42', icon: '⚙' },
                  { label: 'Threads',            value: result.metrics.totalThreads,                      color: '#a78bfa', icon: '🧵' },
                  { label: 'Avg Wait (ms)',      value: result.metrics.avgWaitingTime?.toFixed(1),        color: '#ffb700', icon: '⏱' },
                  { label: 'Avg TAT (ms)',       value: result.metrics.avgTurnaroundTime?.toFixed(1),     color: '#00c8ff', icon: '⏳' },
                  { label: 'Context Switches',   value: result.metrics.totalContextSwitches,              color: '#ff4757', icon: '↔' },
                  { label: 'I/O Requests',       value: result.metrics.totalIoRequests,                   color: '#00ffa3', icon: '💾' },
                ].map(m => (
                  <div key={m.label} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${m.color}22`,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: 'monospace' }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.icon} {m.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: activeTab === tab.id ? '#ff8c42' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab.id ? 700 : 400, fontSize: 13,
                    borderBottom: `2px solid ${activeTab === tab.id ? '#ff8c42' : 'transparent'}`,
                    marginBottom: -1, transition: 'all 0.2s',
                  }}>{tab.label}</button>
                ))}
              </div>

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>State Transition Log</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['ALL', 'PROCESS', 'THREAD'].map(f => (
                        <button key={f} onClick={() => setFilterType(f)} style={{
                          padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
                          background: filterType === f ? 'rgba(255,140,66,0.15)' : 'transparent',
                          border: `1px solid ${filterType === f ? '#ff8c42' : 'var(--border)'}`,
                          color: filterType === f ? '#ff8c42' : 'var(--text-secondary)',
                        }}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 440, overflowY: 'auto', paddingRight: 2 }}>
                    {filteredLog.map((entry, i) => <TransitionRow key={i} entry={entry} />)}
                  </div>
                </div>
              )}

              {/* PCB Tab */}
              {activeTab === 'pcb' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 16 }}>⚙</span>
                      <div className="section-title" style={{ marginBottom: 0 }}>Process Control Blocks (PCB)</div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>PID</th><th>Name</th><th>Type</th><th>Priority</th>
                            <th>Burst Time</th><th>Threads</th><th>I/O Reqs</th><th>State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.pcbs.map(p => (
                            <tr key={p.pid}>
                              <td style={{ color: '#ff8c42', fontWeight: 700, fontFamily: 'monospace' }}>#{p.pid}</td>
                              <td style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.name}</td>
                              <td>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                                  background: p.processType === 'CPU-bound' ? 'rgba(0,200,255,0.12)' : 'rgba(167,139,250,0.12)',
                                  color: p.processType === 'CPU-bound' ? '#00c8ff' : '#a78bfa',
                                  border: `1px solid ${p.processType === 'CPU-bound' ? '#00c8ff33' : '#a78bfa33'}`,
                                }}>{p.processType}</span>
                              </td>
                              <td style={{ fontFamily: 'monospace', color: '#ffb700' }}>{p.priority}</td>
                              <td style={{ fontFamily: 'monospace' }}>{p.burstTime} ms</td>
                              <td style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{p.threads.length}</td>
                              <td style={{ fontFamily: 'monospace', color: '#00ffa3' }}>{p.ioRequests}</td>
                              <td><StateBadge state="TERMINATED" small /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {includeThreads && result.pcbs[0]?.threads?.length > 0 && (
                    <div className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 16 }}>🧵</span>
                        <div className="section-title" style={{ marginBottom: 0 }}>Thread Control Blocks (TCB)</div>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>TID</th><th>Name</th><th>Parent PID</th><th>Priority</th><th>State</th></tr>
                          </thead>
                          <tbody>
                            {result.pcbs.flatMap(p =>
                              p.threads.map(t => (
                                <tr key={t.tid}>
                                  <td style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace' }}>{t.tid}</td>
                                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.name}</td>
                                  <td style={{ color: '#ff8c42', fontFamily: 'monospace' }}>#{p.pid}</td>
                                  <td style={{ fontFamily: 'monospace', color: '#ffb700' }}>{t.priority}</td>
                                  <td><StateBadge state="TERMINATED" small /></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Workload Tab */}
              {activeTab === 'workload' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card">
                    <div className="section-title">Workload Distribution</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {[
                        { label: 'CPU-bound', count: result.metrics.cpuBoundCount, total: result.metrics.totalProcesses, color: '#00c8ff', icon: '🖥' },
                        { label: 'I/O-bound', count: result.metrics.ioBoundCount,  total: result.metrics.totalProcesses, color: '#a78bfa', icon: '💾' },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.icon} {item.label} Processes</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 14, color: item.color, fontWeight: 800 }}>
                              {item.count} / {item.total}
                            </span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{
                              height: '100%', borderRadius: 4, background: item.color,
                              width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%`,
                              transition: 'width 0.9s ease',
                              boxShadow: `0 0 8px ${item.color}66`,
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            {item.total > 0 ? Math.round((item.count / item.total) * 100) : 0}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="section-title">Performance Summary</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Avg Waiting Time',       value: `${result.metrics.avgWaitingTime?.toFixed(2)} ms`,    color: '#ffb700' },
                        { label: 'Avg Turnaround Time',    value: `${result.metrics.avgTurnaroundTime?.toFixed(2)} ms`, color: '#00c8ff' },
                        { label: 'Total Context Switches', value: result.metrics.totalContextSwitches,                  color: '#ff4757' },
                        { label: 'Total I/O Requests',     value: result.metrics.totalIoRequests,                       color: '#00ffa3' },
                      ].map(item => (
                        <div key={item.label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: 9,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${item.color}18`,
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '70px 40px' }}>
              <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.5 }}>⚙</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Ready to Simulate</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Configure the parameters on the left and click <strong style={{ color: '#ff8c42' }}>Run Simulation</strong>
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '70px 40px' }}>
              <div className="spinner" style={{ width: 36, height: 36, borderTopColor: '#ff8c42', borderColor: 'rgba(255,140,66,0.15)', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Running simulation...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
