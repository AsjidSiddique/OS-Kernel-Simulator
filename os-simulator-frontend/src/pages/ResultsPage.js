import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const MODULE_LABELS = { scheduling: '⏱ Scheduling', memory: '◈ Memory', synchronization: '⟳ Sync', processes: '⚙ Processes' };
const MODULE_COLORS = { scheduling: '#00c8ff', memory: '#00ffa3', synchronization: '#a78bfa', processes: '#ff8c42' };

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchResults = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/simulate/results?page=${page}&limit=10`);
      setResults(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load results.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchResults(1); }, [fetchResults]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this simulation result?')) return;
    setDeleting(id);
    try {
      await api.delete(`/simulate/results/${id}`);
      setResults(prev => prev.filter(r => r._id !== id));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch { setError('Failed to delete.'); }
    finally { setDeleting(null); }
  };

  const getModuleType = (result) => {
    if (result.scheduling) return 'scheduling';
    if (result.memory) return 'memory';
    if (result.synchronization) return 'synchronization';
    if (result.processes) return 'processes';
    return 'unknown';
  };

  const getResultSummary = (result) => {
    const type = getModuleType(result);
    if (type === 'scheduling' && result.scheduling) {
      const s = result.scheduling;
      return `${s.algorithm} · ${s.processes?.length} processes · CPU: ${s.metrics?.cpuUtilization}%`;
    }
    if (type === 'memory' && result.memory) {
      const m = result.memory;
      return `${m.algorithm} · ${m.frameCount} frames · Faults: ${m.totalPageFaults} · Hit: ${(m.hitRatio * 100).toFixed(1)}%`;
    }
    if (type === 'synchronization' && result.synchronization) {
      const s = result.synchronization;
      return `${s.primitive} · ${s.threadCount} threads · Races: ${s.racesDetected}`;
    }
    if (type === 'processes' && result.processes) {
      const p = result.processes;
      return `${p.processCount} processes · ${p.metrics?.totalThreads} threads`;
    }
    return 'No data';
  };

  if (loading && results.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--cyan)' }}>
        <div className="spinner" /> Loading results...
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24, color: 'var(--amber)' }}>◉</span>
          <h1>Saved Results</h1>
          <span className="badge badge-amber">{pagination.total} total</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Browse and manage your saved simulation results.
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}><span>⚠</span> {error}</div>}

      {results.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💾</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Saved Results Yet</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Run a simulation and click <strong>Save</strong> to store results here.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {results.map(result => {
              const type = getModuleType(result);
              const color = MODULE_COLORS[type] || '#7a9ec0';
              const isExpanded = expanded === result._id;

              return (
                <div key={result._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer',
                  }} onClick={() => setExpanded(isExpanded ? null : result._id)}>

                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, color,
                    }}>
                      {MODULE_LABELS[type]?.split(' ')[0] || '📄'}
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.title}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {MODULE_LABELS[type] || type}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getResultSummary(result)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(result.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(result._id); }}
                        disabled={deleting === result._id}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6, opacity: deleting === result._id ? 0.5 : 1 }}
                      >✕</button>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'rgba(0,0,0,0.1)' }}>
                      {type === 'scheduling' && result.scheduling && (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12, marginBottom: 14 }}>
                            {[
                              { label: 'Algorithm', value: result.scheduling.algorithm },
                              { label: 'Avg Wait', value: `${result.scheduling.metrics?.avgWaitingTime?.toFixed(2)} ms` },
                              { label: 'Avg TAT', value: `${result.scheduling.metrics?.avgTurnaroundTime?.toFixed(2)} ms` },
                              { label: 'CPU Util', value: `${result.scheduling.metrics?.cpuUtilization}%` },
                            ].map(m => (
                              <div key={m.label} style={{ padding: '8px 12px', background: 'rgba(0,200,255,0.04)', borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#00c8ff' }}>{m.value}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {type === 'memory' && result.memory && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12 }}>
                          {[
                            { label: 'Algorithm', value: result.memory.algorithm },
                            { label: 'Frames', value: result.memory.frameCount },
                            { label: 'Page Faults', value: result.memory.totalPageFaults },
                            { label: 'Hit Ratio', value: `${(result.memory.hitRatio * 100).toFixed(1)}%` },
                          ].map(m => (
                            <div key={m.label} style={{ padding: '8px 12px', background: 'rgba(0,255,163,0.04)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#00ffa3' }}>{m.value}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {type === 'synchronization' && result.synchronization && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12 }}>
                          {[
                            { label: 'Primitive', value: result.synchronization.primitive },
                            { label: 'Threads', value: result.synchronization.threadCount },
                            { label: 'Log Events', value: result.synchronization.log?.length },
                            { label: 'Races', value: result.synchronization.racesDetected },
                          ].map(m => (
                            <div key={m.label} style={{ padding: '8px 12px', background: 'rgba(167,139,250,0.04)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>{m.value}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {result.notes && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <strong>Notes:</strong> {result.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => fetchResults(p)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: `1px solid ${p === pagination.page ? 'var(--cyan)' : 'var(--border)'}`,
                    background: p === pagination.page ? 'var(--cyan-dim)' : 'transparent',
                    color: p === pagination.page ? 'var(--cyan)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: p === pagination.page ? 700 : 400, fontSize: 13,
                  }}
                >{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
