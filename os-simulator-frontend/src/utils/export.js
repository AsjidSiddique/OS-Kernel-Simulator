export const exportSchedulingResults = (result) => {
  if (!result) return;
  const rows = [
    ['Process', 'Arrival Time', 'Burst Time', 'Priority', 'Completion Time', 'Waiting Time', 'Turnaround Time'],
    ...result.processes.map(p => [
      p.name || `P${p.pid}`, p.arrivalTime, p.burstTime, p.priority,
      p.completionTime, p.waitingTime, p.turnaroundTime,
    ]),
    [],
    ['Algorithm', result.algorithm],
    ['Avg Waiting Time', result.metrics?.avgWaitingTime?.toFixed(2)],
    ['Avg Turnaround Time', result.metrics?.avgTurnaroundTime?.toFixed(2)],
    ['CPU Utilization (%)', result.metrics?.cpuUtilization],
    ['Throughput', result.metrics?.throughput],
  ];
  downloadCSV(rows, `scheduling_${result.algorithm}_${Date.now()}.csv`);
};

export const exportMemoryResults = (result) => {
  if (!result) return;
  const rows = [
    ['Step', 'Page', 'Page Fault', 'Replaced Page', 'Frames'],
    ...result.frames.map(s => [
      s.step, s.page, s.pageFault ? 'YES' : 'NO',
      s.replacedPage ?? '-', s.frames.join(' | '),
    ]),
    [],
    ['Algorithm', result.algorithm],
    ['Total Page Faults', result.totalPageFaults],
    ['Hit Ratio', result.hitRatio],
  ];
  downloadCSV(rows, `memory_${result.algorithm}_${Date.now()}.csv`);
};

export const exportSyncResults = (result) => {
  if (!result) return;
  const rows = [
    ['Time', 'Thread', 'Event', 'Resource'],
    ...result.log.map(e => [e.time, e.thread, e.event, e.resource]),
    [],
    ['Primitive', result.primitive],
    ['Thread Count', result.threadCount],
    ['Races Detected', result.racesDetected],
    ['Deadlock Detected', result.deadlockDetected ? 'YES' : 'NO'],
  ];
  downloadCSV(rows, `sync_${result.primitive}_${Date.now()}.csv`);
};

const downloadCSV = (rows, filename) => {
  const csv = rows.map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
