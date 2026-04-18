import React, { useState, useRef } from 'react';

const COLORS = [
  '#00c8ff','#00ffa3','#ffb700','#a78bfa','#ff6b9d','#ff8c42',
  '#4cc9f0','#f72585','#06d6a0','#ffd166','#118ab2','#ef476f',
];

function getColor(pid, pidList) {
  if (pid === -1) return null;
  const idx = pidList.indexOf(pid);
  return COLORS[idx % COLORS.length];
}

export default function GanttChart({ ganttChart = [], processes = [] }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  if (!ganttChart || ganttChart.length === 0) return null;

  const pidList = [...new Set(processes.map(p => p.pid))];
  const totalTime = ganttChart[ganttChart.length - 1]?.end || 1;

  return (
    <div>
      <div className="section-title">Gantt Chart</div>

      {/* Chart container — uses full available width, no fixed minWidth */}
      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
        {/* Bars row */}
        <div style={{
          display: 'flex',
          width: '100%',
          minWidth: Math.max(ganttChart.length * 28, 300),
          height: 52,
          gap: 2,
          marginBottom: 4,
        }}>
          {ganttChart.map((slot, i) => {
            const pct = ((slot.end - slot.start) / totalTime) * 100;
            const color = getColor(slot.pid, pidList);
            const isIdle = slot.pid === -1;
            const proc = processes.find(p => p.pid === slot.pid);
            const label = proc?.name || (slot.pid === -1 ? '' : `P${slot.pid}`);

            return (
              <div
                key={i}
                className="gantt-bar"
                style={{
                  flex: `${pct} 0 0`,
                  minWidth: 20,
                  background: isIdle
                    ? 'repeating-linear-gradient(45deg, #1a2744 0px, #1a2744 4px, #0d1a30 4px, #0d1a30 8px)'
                    : color,
                  color: isIdle ? '#3d5a7a' : '#000',
                  fontSize: pct < 4 ? 0 : 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isIdle ? '1px solid #1e2d4a' : 'none',
                  borderRadius: 6,
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ slot, proc, x: rect.left, y: rect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {!isIdle && pct >= 4 && label}
              </div>
            );
          })}
        </div>

        {/* Time axis */}
        <div style={{
          display: 'flex',
          width: '100%',
          minWidth: Math.max(ganttChart.length * 28, 300),
        }}>
          {ganttChart.map((slot, i) => {
            const pct = ((slot.end - slot.start) / totalTime) * 100;
            return (
              <div key={i} style={{
                flex: `${pct} 0 0`,
                minWidth: 20,
                display: 'flex',
                justifyContent: 'flex-start',
                paddingLeft: 2,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                  {slot.start}
                </span>
              </div>
            );
          })}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>
            {totalTime}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="chip-row" style={{ marginTop: 14 }}>
        {processes.map((p, i) => (
          <div key={p.pid} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {p.name || `P${p.pid}`}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1a2744', border: '1px solid #1e2d4a' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Idle</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 8, top: tooltip.y - 80,
          zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          pointerEvents: 'none',
          boxShadow: 'var(--shadow-lg)',
          minWidth: 140,
        }}>
          {tooltip.slot.pid === -1 ? (
            <div style={{ color: 'var(--text-muted)' }}>⏸ CPU Idle</div>
          ) : (
            <>
              <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 6 }}>
                {tooltip.proc?.name || `P${tooltip.slot.pid}`}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Start: <span style={{ color: 'var(--text-primary)' }}>{tooltip.slot.start}</span></div>
              <div style={{ color: 'var(--text-secondary)' }}>End: <span style={{ color: 'var(--text-primary)' }}>{tooltip.slot.end}</span></div>
              <div style={{ color: 'var(--text-secondary)' }}>Duration: <span style={{ color: 'var(--amber)' }}>{tooltip.slot.end - tooltip.slot.start}</span></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
