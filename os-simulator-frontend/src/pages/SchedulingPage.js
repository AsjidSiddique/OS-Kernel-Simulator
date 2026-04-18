import React, { useState, useRef } from 'react';
import api from '../utils/api';
import GanttChart from '../components/GanttChart';
import { exportSchedulingResults } from '../utils/export';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const ALGORITHMS = [
  { value: 'FCFS',       label: 'FCFS',        desc: 'First Come First Served' },
  { value: 'SJF',        label: 'SJF',         desc: 'Shortest Job First' },
  { value: 'RoundRobin', label: 'Round Robin', desc: 'Preemptive with time quantum' },
  { value: 'Priority',   label: 'Priority',    desc: 'Non-preemptive priority scheduling' },
];

const DEFAULT_PROCESSES = [
  { pid: 1, name: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
  { pid: 2, name: 'P2', arrivalTime: 2, burstTime: 4, priority: 1 },
  { pid: 3, name: 'P3', arrivalTime: 4, burstTime: 3, priority: 3 },
  { pid: 4, name: 'P4', arrivalTime: 6, burstTime: 5, priority: 2 },
];

const CHART_THEME = {
  background: 'transparent', color: '#e8f4ff',
  tooltip: { contentStyle: { background: '#0d1f3c', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, color: '#e8f4ff', fontSize: 12 } },
};

export default function SchedulingPage() {
  const [algorithm, setAlgorithm] = useState('FCFS');
  const [quantum, setQuantum] = useState(2);
  const [processes, setProcesses] = useState(DEFAULT_PROCESSES);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const csvRef = useRef();

  const addProcess = () => {
    const pid = processes.length > 0 ? Math.max(...processes.map(p => p.pid)) + 1 : 1;
    setProcesses(prev => [...prev, { pid, name: `P${pid}`, arrivalTime: 0, burstTime: 4, priority: 1 }]);
  };
  const removeProcess = (idx) => setProcesses(prev => prev.filter((_, i) => i !== idx));
  const updateProcess = (idx, field, value) => {
    setProcesses(prev => prev.map((p, i) => i === idx ? { ...p, [field]: field === 'name' ? value : Number(value) } : p));
  };

  const runSimulation = async () => {
    if (processes.length === 0) { setError('Add at least one process.'); return; }
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await api.post('/simulate/scheduling', { algorithm, processes, quantum: Number(quantum) });
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
        title: saveTitle || `Scheduling — ${algorithm} — ${new Date().toLocaleString()}`,
        scheduling: result,
      });
      setSaved(true); setShowSaveDialog(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/csv/scheduling?algorithm=${algorithm}&quantum=${quantum}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data.data); setError('');
    } catch (err) { setError(err.response?.data?.message || 'CSV import failed.'); }
    e.target.value = '';
  };

  const chartData = result?.processes?.map(p => ({
    name: p.name || `P${p.pid}`,
    'Waiting Time': parseFloat(p.waitingTime?.toFixed(2)),
    'Turnaround Time': parseFloat(p.turnaroundTime?.toFixed(2)),
  })) || [];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24, color: 'var(--cyan)' }}>⏱</span>
          <h1>CPU Scheduling</h1>
          <span className="badge badge-cyan">Simulation</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Simulate FCFS, SJF, Round Robin and Priority scheduling algorithms with Gantt chart visualization.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Config Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="section-title">Algorithm</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {ALGORITHMS.map(a => (
                <button
                  key={a.value}
                  onClick={() => setAlgorithm(a.value)}
                  style={{
                    padding: '9px 14px', borderRadius: 9, border: `1px solid ${algorithm === a.value ? 'rgba(0,200,255,0.4)' : 'var(--border)'}`,
                    background: algorithm === a.value ? 'var(--cyan-dim)' : 'transparent',
                    color: algorithm === a.value ? 'var(--cyan)' : 'var(--text-secondary)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    fontFamily: 'var(--font-display)', fontWeight: algorithm === a.value ? 700 : 400,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{a.desc}</div>
                </button>
              ))}
            </div>

            {algorithm === 'RoundRobin' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Time Quantum</label>
                <input type="number" className="form-input" min={1} max={20} value={quantum} onChange={e => setQuantum(e.target.value)} />
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runSimulation} disabled={loading}>
              {loading ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Running...</> : '▶ Run Simulation'}
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="file" ref={csvRef} accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} />
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => csvRef.current?.click()}>⬆ CSV</button>
              {result && <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => exportSchedulingResults(result)}>⬇ Export</button>}
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}
          {saved && <div className="alert alert-success"><span>✓</span> Simulation saved successfully!</div>}

          {/* Process Table Input */}
          <div className="card" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Processes</div>
              <button className="btn btn-secondary btn-sm" onClick={addProcess}>+ Add Process</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Arrival</th><th>Burst</th>
                    {algorithm === 'Priority' && <th>Priority</th>}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p, i) => (
                    <tr key={p.pid}>
                      <td><input type="text" value={p.name} onChange={e => updateProcess(i, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 50, fontWeight: 700 }} /></td>
                      <td><input type="number" min={0} value={p.arrivalTime} onChange={e => updateProcess(i, 'arrivalTime', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 50 }} /></td>
                      <td><input type="number" min={1} value={p.burstTime} onChange={e => updateProcess(i, 'burstTime', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 50 }} /></td>
                      {algorithm === 'Priority' && <td><input type="number" min={1} value={p.priority} onChange={e => updateProcess(i, 'priority', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 50 }} /></td>}
                      <td><button onClick={() => removeProcess(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Results */}
          {result && (
            <>
              {/* Metrics */}
              <div className="metric-grid">
                {[
                  { label: 'Avg Waiting Time', value: `${result.metrics?.avgWaitingTime?.toFixed(2)} ms`, color: 'var(--cyan)' },
                  { label: 'Avg Turnaround', value: `${result.metrics?.avgTurnaroundTime?.toFixed(2)} ms`, color: 'var(--green)' },
                  { label: 'CPU Utilization', value: `${result.metrics?.cpuUtilization}%`, color: 'var(--amber)' },
                  { label: 'Throughput', value: result.metrics?.throughput, color: 'var(--purple)' },
                ].map(m => (
                  <div key={m.label} className="metric-card">
                    <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
                    <div className="metric-label">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Gantt Chart */}
              <div className="card" style={{ minWidth: 0 }}>
                <GanttChart ganttChart={result.ganttChart} processes={result.processes} />
              </div>

              {/* Process Results Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>Results Table</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSaveTitle(''); setShowSaveDialog(true); }}>💾 Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportSchedulingResults(result)}>⬇ Export CSV</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Completion</th><th>Waiting</th><th>Turnaround</th></tr>
                    </thead>
                    <tbody>
                      {result.processes.map(p => (
                        <tr key={p.pid}>
                          <td style={{ color: 'var(--cyan)', fontWeight: 700 }}>{p.name || `P${p.pid}`}</td>
                          <td>{p.arrivalTime}</td><td>{p.burstTime}</td><td>{p.completionTime}</td>
                          <td style={{ color: 'var(--amber)' }}>{p.waitingTime}</td>
                          <td style={{ color: 'var(--green)' }}>{p.turnaroundTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bar Chart — uses 100% width so it auto-resizes with sidebar */}
              <div className="card" style={{ minWidth: 0 }}>
                <div className="section-title">Performance Comparison</div>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,255,0.07)" />
                      <XAxis dataKey="name" tick={{ fill: '#7a9ec0', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#7a9ec0', fontSize: 11 }} />
                      <Tooltip {...CHART_THEME.tooltip} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Waiting Time" fill="#ffb700" radius={[4,4,0,0]} />
                      <Bar dataKey="Turnaround Time" fill="#00c8ff" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Save Dialog */}
              {showSaveDialog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                  <div className="card" style={{ width: 380, padding: 28 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Save Simulation</h3>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                      <label className="form-label">Title (optional)</label>
                      <input type="text" className="form-input" placeholder={`Scheduling — ${algorithm} — ${new Date().toLocaleString()}`} value={saveTitle} onChange={e => setSaveTitle(e.target.value)} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                        {saving ? <><div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} /> Saving...</> : '💾 Save'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowSaveDialog(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏱</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to Schedule</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Select an algorithm and click <strong>Run Simulation</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
