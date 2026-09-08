/**
 * 1% Charging Performance Table Component
 * Displays confirmed 1% transitions (0->1%, 1->2%, ..., 99->100%) and handles skipped percentage transitions.
 */

import React, { useState } from 'react';
import { Table, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PercentageTransition, TransitionStatus } from '../types/charging';

interface OnePercentTableProps {
  transitions: PercentageTransition[];
}

export const OnePercentTable: React.FC<OnePercentTableProps> = ({ transitions }) => {
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'SKIPPED'>('ALL');

  const filtered = transitions.filter(t => {
    if (filter === 'CONFIRMED') return t.status === TransitionStatus.CONFIRMED;
    if (filter === 'SKIPPED') return t.status === TransitionStatus.PERCENTAGE_TRANSITION_SKIPPED;
    return true;
  });

  const downloadCsv = () => {
    if (transitions.length === 0) return;
    const headers = [
      'From (%)', 'To (%)', 'Start Time', 'End Time', 'Time Taken (s)', 'Duration',
      'Avg V', 'Min V', 'Max V', 'Avg A', 'Min A', 'Max A', 'Avg W', 'Max W',
      'Energy (Wh)', 'Charge (Ah)', 'Readings', 'Status', 'Notes'
    ];
    const rows = transitions.map(t => [
      t.fromCharge, t.toCharge, t.startTime, t.endTime, t.timeTakenSeconds, t.formattedDuration,
      t.averageVoltage, t.minVoltage, t.maxVoltage, t.averageCurrent, t.minCurrent, t.maxCurrent,
      t.averagePower, t.maxPower, t.energyUsedWh, t.chargeAccumulatedAh, t.readingCount, t.status, `"${t.notes || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `1_Percent_Charging_Transitions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="one-percent-table-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Table className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            1% CHARGING INTERVAL PERFORMANCE DATASET
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
            {transitions.length} Intervals
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex items-center bg-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-1 rounded font-medium ${filter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              All ({transitions.length})
            </button>
            <button
              onClick={() => setFilter('CONFIRMED')}
              className={`px-2 py-1 rounded font-medium ${filter === 'CONFIRMED' ? 'bg-slate-700 text-emerald-300' : 'text-slate-400'}`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setFilter('SKIPPED')}
              className={`px-2 py-1 rounded font-medium ${filter === 'SKIPPED' ? 'bg-slate-700 text-amber-300' : 'text-slate-400'}`}
            >
              Skipped
            </button>
          </div>

          <button
            id="download-1pct-csv-btn"
            onClick={downloadCsv}
            disabled={transitions.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs px-2.5 py-1.5 rounded transition border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-96 border border-slate-800 rounded-lg">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
            <tr>
              <th className="py-2 px-3">Interval</th>
              <th className="py-2 px-3">Start</th>
              <th className="py-2 px-3">End</th>
              <th className="py-2 px-3 text-right">Time (s)</th>
              <th className="py-2 px-3 text-right">Duration</th>
              <th className="py-2 px-3 text-right">Avg V</th>
              <th className="py-2 px-3 text-right">Min/Max V</th>
              <th className="py-2 px-3 text-right">Avg A</th>
              <th className="py-2 px-3 text-right">Min/Max A</th>
              <th className="py-2 px-3 text-right">Avg W</th>
              <th className="py-2 px-3 text-right">Energy (Wh)</th>
              <th className="py-2 px-3 text-right">Charge (Ah)</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-slate-500 font-sans">
                  No confirmed 1% transitions recorded yet. Keep the camera focused on the display during charging.
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-800/50 transition ${
                    t.status === TransitionStatus.PERCENTAGE_TRANSITION_SKIPPED ? 'bg-amber-950/20 text-amber-200/90' : 'text-slate-300'
                  }`}
                >
                  <td className="py-2 px-3 font-bold text-slate-100 whitespace-nowrap">
                    {t.fromCharge}% → {t.toCharge}%
                  </td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{t.startTime}</td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{t.endTime}</td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-300">{t.timeTakenSeconds}s</td>
                  <td className="py-2 px-3 text-right text-slate-400">{t.formattedDuration}</td>
                  <td className="py-2 px-3 text-right text-sky-300">{t.averageVoltage.toFixed(2)}V</td>
                  <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                    {t.minVoltage.toFixed(1)} / {t.maxVoltage.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-300">{t.averageCurrent.toFixed(3)}A</td>
                  <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                    {t.minCurrent.toFixed(2)} / {t.maxCurrent.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-yellow-300">{t.averagePower.toFixed(1)}W</td>
                  <td className="py-2 px-3 text-right text-cyan-300 font-bold">{t.energyUsedWh.toFixed(3)}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">{t.chargeAccumulatedAh.toFixed(3)}</td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {t.status === TransitionStatus.CONFIRMED ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                        <CheckCircle2 className="w-3 h-3" /> CONFIRMED
                      </span>
                    ) : (
                      <span
                        title={t.notes}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60"
                      >
                        <AlertTriangle className="w-3 h-3" /> SKIPPED GAP
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
