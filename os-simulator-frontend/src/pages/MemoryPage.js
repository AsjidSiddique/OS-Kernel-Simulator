import React, { useState, useRef } from 'react';
import api from '../utils/api';
import { exportMemoryResults } from '../utils/export';

const ALGORITHMS = [
  { value: 'FIFO',    label: 'FIFO',    desc: 'First In First Out' },
  { value: 'LRU',     label: 'LRU',     desc: 'Least Recently Used' },
  { value: 'Optimal', label: 'Optimal', desc: "Bélády's Optimal Algorithm" },
];

const DEFAULT_REF = '7 0 1 2 0 3 0 4 2 3 0 3 2';

export default function MemoryPage() {
  const [algorithm, setAlgorithm] = useState('FIFO');
  const [refStringRaw, setRefStringRaw] = useState(DEFAULT_REF);
  const [frameCount, setFrameCount] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const csvRef = useRef();

  const parseRefString = (raw) =>
    raw.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0);

  const runSimulation = async () => {
    const referenceString = parseRefString(refStringRaw);
    if (referenceString.length === 0) { setError('Enter a valid reference string.'); return; }
    if (frameCount < 1) { setError('Frame count must be at least 1.'); return; }
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await api.post('/simulate/memory', { algorithm, referenceString, frameCount: Number(frameCount) });
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
        title: saveTitle || `Memory — ${algorithm} — ${new Date().toLocaleString()}`,
        memory: result,
      });
      setSaved(true); setShowSave(false);
    } catch (err) { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await api.post(`/csv/memory?algorithm=${algorithm}&frameCount=${frameCount}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data.data); setError('');
    } catch (err) { setError(err.response?.data?.message || 'CSV import failed.'); }
    e.target.value = '';
  };

  const faultRate = result ? ((result.totalPageFaults / result.referenceString.length) * 100).toFixed(1) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24, color: 'var(--green)' }}>◈</span>
          <h1>Memory Management</h1>
          <span className="badge badge-green">Page Replacement</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Simulate paging-based memory management with FIFO, LRU, and Optimal page replacement algorithms.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="section-title">Configuration</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {ALGORITHMS.map(a => (
                <button key={a.value} onClick={() => setAlgorithm(a.value)} style={{
                  padding: '9px 14px', borderRadius: 9, border: `1px solid ${algorithm === a.value ? 'rgba(0,255,163,0.4)' : 'var(--border)'}`,
                  background: algorithm === a.value ? 'var(--green-dim)' : 'transparent',
                  color: algorithm === a.value ? 'var(--green)' : 'var(--text-secondary)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  fontFamily: 'var(--font-display)', fontWeight: algorithm === a.value ? 700 : 400,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{a.desc}</div>
                </button>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Reference String</label>
              <input type="text" className="form-input" value={refStringRaw} onChange={e => setRefStringRaw(e.target.value)} placeholder="e.g. 7 0 1 2 0 3 4" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Space or comma separated page numbers</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Number of Frames</label>
              <input type="number" className="form-input" min={1} max={10} value={frameCount} onChange={e => setFrameCount(e.target.value)} />
            </div>

            <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={runSimulation} disabled={loading}>
              {loading ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Running...</> : '▶ Run Simulation'}
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="file" ref={csvRef} accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} />
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => csvRef.current?.click()}>⬆ CSV</button>
              {result && <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => exportMemoryResults(result)}>⬇ Export</button>}
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}
          {saved && <div className="alert alert-success"><span>✓</span> Saved successfully!</div>}

          {result && (
            <>
              {/* Metrics */}
              <div className="metric-grid">
                {[
                  { label: 'Total References', value: result.referenceString.length, color: 'var(--cyan)' },
                  { label: 'Page Faults', value: result.totalPageFaults, color: 'var(--red)' },
                  { label: 'Page Hits', value: result.referenceString.length - result.totalPageFaults, color: 'var(--green)' },
                  { label: 'Hit Ratio', value: `${(result.hitRatio * 100).toFixed(1)}%`, color: 'var(--amber)' },
                  { label: 'Fault Rate', value: `${faultRate}%`, color: 'var(--purple)' },
                  { label: 'Frames', value: result.frameCount, color: 'var(--cyan)' },
                ].map(m => (
                  <div key={m.label} className="metric-card">
                    <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
                    <div className="metric-label">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Frame Visualization */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>Frame Allocation Trace</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSaveTitle(''); setShowSave(true); }}>💾 Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportMemoryResults(result)}>⬇ Export</button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: 2, minWidth: result.frames.length * 52, marginBottom: 6 }}>
                    {result.frames.map((step, i) => (
                      <div key={i} style={{
                        flex: '0 0 48px', textAlign: 'center',
                        background: step.pageFault ? 'rgba(255,71,87,0.1)' : 'rgba(0,255,163,0.06)',
                        border: `1px solid ${step.pageFault ? 'rgba(255,71,87,0.25)' : 'rgba(0,255,163,0.15)'}`,
                        borderRadius: 6, padding: '6px 4px',
                      }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{step.page}</div>
                        {Array.from({ length: result.frameCount }).map((_, fi) => (
                          <div key={fi} style={{
                            height: 22, margin: '2px 0', borderRadius: 4,
                            background: step.frames[fi] !== undefined ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${step.frames[fi] !== undefined ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-mono)', fontSize: 11,
                            color: step.frames[fi] !== undefined ? 'var(--cyan)' : 'transparent',
                          }}>
                            {step.frames[fi] !== undefined ? step.frames[fi] : '-'}
                          </div>
                        ))}
                        <div style={{ fontSize: 9, marginTop: 4, color: step.pageFault ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                          {step.pageFault ? 'FAULT' : 'HIT'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step table */}
              <div className="card">
                <div className="section-title">Step-by-Step Results</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Step</th><th>Page</th><th>Frames</th><th>Result</th><th>Replaced</th></tr>
                    </thead>
                    <tbody>
                      {result.frames.map(step => (
                        <tr key={step.step}>
                          <td style={{ color: 'var(--text-muted)' }}>{step.step}</td>
                          <td style={{ color: 'var(--cyan)', fontWeight: 700 }}>{step.page}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{step.frames.join(', ')}</td>
                          <td>
                            <span className={`badge ${step.pageFault ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 9 }}>
                              {step.pageFault ? '✕ PAGE FAULT' : '✓ HIT'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--amber)' }}>{step.replacedPage ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Save Dialog */}
              {showSave && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                  <div className="card" style={{ width: 380, padding: 28 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Save Simulation</h3>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                      <label className="form-label">Title (optional)</label>
                      <input type="text" className="form-input" placeholder={`Memory — ${algorithm} — ${new Date().toLocaleString()}`} value={saveTitle} onChange={e => setSaveTitle(e.target.value)} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : '💾 Save'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowSave(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to Simulate</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Configure parameters and click <strong>Run Simulation</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
