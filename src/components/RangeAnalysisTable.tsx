/**
 * Charge Range Analysis Table Component (10-Bucket Aggregates: 0-10% to 90-100%)
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { ChargeRangeSummary } from '../types/charging';

interface RangeAnalysisTableProps {
  rangeSummaries: ChargeRangeSummary[];
}

export const RangeAnalysisTable: React.FC<RangeAnalysisTableProps> = ({ rangeSummaries }) => {
  return (
    <div id="range-analysis-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            CHARGE-RANGE PERFORMANCE ANALYSIS (10% BLOCKS)
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Range</th>
              <th className="py-2.5 px-3 text-right">Total Time</th>
              <th className="py-2.5 px-3 text-right">Avg V</th>
              <th className="py-2.5 px-3 text-right">Avg A</th>
              <th className="py-2.5 px-3 text-right">Avg W</th>
              <th className="py-2.5 px-3 text-right">Energy (Wh)</th>
              <th className="py-2.5 px-3 text-right">Charge (Ah)</th>
              <th className="py-2.5 px-3 text-right">Avg Time / 1%</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {rangeSummaries.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 text-slate-300 transition">
                <td className="py-2.5 px-3 font-bold text-slate-200">{r.rangeLabel}</td>
                <td className="py-2.5 px-3 text-right text-indigo-300 font-bold">
                  {r.totalTimeSeconds > 0 ? `${r.formattedTime} (${r.totalTimeSeconds}s)` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-sky-300">
                  {r.totalTimeSeconds > 0 ? `${r.averageVoltage.toFixed(2)} V` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-300">
                  {r.totalTimeSeconds > 0 ? `${r.averageCurrent.toFixed(3)} A` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-yellow-300">
                  {r.totalTimeSeconds > 0 ? `${r.averagePower.toFixed(1)} W` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-cyan-300 font-bold">
                  {r.totalTimeSeconds > 0 ? `${r.energyConsumedWh.toFixed(3)} Wh` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                  {r.totalTimeSeconds > 0 ? `${r.chargeAccumulatedAh.toFixed(3)} Ah` : '--'}
                </td>
                <td className="py-2.5 px-3 text-right text-purple-300">
                  {r.totalTimeSeconds > 0 ? `${r.averageTimePerOnePercent} s` : '--'}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded font-sans font-medium ${
                      r.status === 'COMPLETE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : r.status === 'PARTIAL'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
