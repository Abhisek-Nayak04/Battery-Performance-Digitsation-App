/**
 * Session Summary & Battery Performance Engineering Review Component
 * Calculates and visualizes key charging benchmarks, CC/CV transition inflection,
 * fastest/slowest intervals, and detailed statistical analysis.
 */

import React from 'react';
import { FileSpreadsheet, Zap, Clock, Battery, HelpCircle, Activity } from 'lucide-react';
import { PercentageTransition, SessionSummary, ValidMeasurement } from '../types/charging';
import { CalculationEngine } from '../services/calculationEngine';

interface SummaryCardProps {
  summary: SessionSummary;
  transitions: PercentageTransition[];
  validMeasurements: ValidMeasurement[];
  onExportExcel: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  transitions,
  validMeasurements,
  onExportExcel,
}) => {
  // Key interval query lookups
  const t01 = transitions.find(t => t.fromCharge === 0 && t.toCharge === 1);
  const t12 = transitions.find(t => t.fromCharge === 1 && t.toCharge === 2);
  const t99100 = transitions.find(t => t.fromCharge === 99 && t.toCharge === 100);

  const ccCvInflection = CalculationEngine.detectCcCvInflection(validMeasurements);

  return (
    <div id="session-summary-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            CHARGING SESSION SUMMARY & PERFORMANCE REVIEW (SECTIONS 21 & 22)
          </h2>
        </div>

        <button
          id="export-excel-primary-btn"
          onClick={onExportExcel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition shadow-[0_0_12px_rgba(16,185,129,0.3)]"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export 6-Sheet Excel (.xlsx)
        </button>
      </div>

      {/* Grid of Key Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg">
          <span className="text-slate-400">Total Duration:</span>
          <div className="font-mono text-lg font-bold text-indigo-300 mt-1">
            {summary.formattedDuration}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {summary.startTime} → {summary.endTime}
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg">
          <span className="text-slate-400">Total Energy (Wh):</span>
          <div className="font-mono text-lg font-bold text-cyan-300 mt-1">
            {summary.totalEnergyWh.toFixed(3)} Wh
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Trapezoidal sum</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg">
          <span className="text-slate-400">Total Capacity (Ah):</span>
          <div className="font-mono text-lg font-bold text-emerald-300 mt-1">
            {summary.totalAccumulatedAh.toFixed(3)} Ah
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Accumulated Charge</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg">
          <span className="text-slate-400">Charge Progress:</span>
          <div className="font-mono text-lg font-bold text-amber-300 mt-1">
            {summary.startingCharge ?? '--'}% → {summary.finalCharge ?? '--'}%
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Δ {(summary.finalCharge !== null && summary.startingCharge !== null) ? `${summary.finalCharge - summary.startingCharge}%` : '--'}
          </span>
        </div>
      </div>

      {/* Electrical Summary Stats Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex flex-col gap-1.5">
          <span className="text-slate-400 font-sans font-medium flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-sky-400" /> Voltage Parameters
          </span>
          <div className="flex justify-between text-slate-300">
            <span>Start Voltage:</span>
            <span className="font-bold">{summary.startingVoltage ?? '--'} V</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Final Voltage:</span>
            <span className="font-bold">{summary.finalVoltage ?? '--'} V</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Min / Max V:</span>
            <span className="font-bold">{summary.minVoltage ?? '--'} V / {summary.maxVoltage ?? '--'} V</span>
          </div>
          <div className="flex justify-between text-sky-400">
            <span>Average V:</span>
            <span className="font-bold">{summary.averageVoltage ?? '--'} V</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex flex-col gap-1.5">
          <span className="text-slate-400 font-sans font-medium flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Current Parameters
          </span>
          <div className="flex justify-between text-slate-300">
            <span>Start Current:</span>
            <span className="font-bold">{summary.startingCurrent ?? '--'} A</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Final Current:</span>
            <span className="font-bold">{summary.finalCurrent ?? '--'} A</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Min / Max A:</span>
            <span className="font-bold">{summary.minCurrent ?? '--'} A / {summary.maxCurrent ?? '--'} A</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Average A:</span>
            <span className="font-bold">{summary.averageCurrent ?? '--'} A</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex flex-col gap-1.5">
          <span className="text-slate-400 font-sans font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-purple-400" /> Pace & Interval Metrics
          </span>
          <div className="flex justify-between text-slate-300">
            <span>Avg Time per 1%:</span>
            <span className="font-bold">{summary.averageTimePerOnePercent} s</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Fastest 1% Interval:</span>
            <span className="font-bold text-emerald-400">
              {summary.fastestOnePercent ? `${summary.fastestOnePercent.from}→${summary.fastestOnePercent.to}% (${summary.fastestOnePercent.timeSeconds}s)` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Slowest 1% Interval:</span>
            <span className="font-bold text-amber-400">
              {summary.slowestOnePercent ? `${summary.slowestOnePercent.from}→${summary.slowestOnePercent.to}% (${summary.slowestOnePercent.timeSeconds}s)` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-purple-400">
            <span>Average Power:</span>
            <span className="font-bold">{summary.averagePower ?? '--'} W</span>
          </div>
        </div>
      </div>

      {/* Section 22: Battery Performance Review Inquiry Grid */}
      <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-3.5 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-300 font-semibold">
          <HelpCircle className="w-4 h-4 text-sky-400" />
          <span>Battery Performance Review & Verification Inquiries</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px]">How long did 0→1% take?</span>
            <div className="font-mono font-bold text-slate-200 mt-1">
              {t01 ? `${t01.timeTakenSeconds}s (${t01.formattedDuration})` : 'Pending reading'}
            </div>
            {t01 && <span className="text-[10px] text-slate-500 font-mono">Energy: {t01.energyUsedWh} Wh</span>}
          </div>

          <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px]">How long did 1→2% take?</span>
            <div className="font-mono font-bold text-slate-200 mt-1">
              {t12 ? `${t12.timeTakenSeconds}s (${t12.formattedDuration})` : 'Pending reading'}
            </div>
            {t12 && <span className="text-[10px] text-slate-500 font-mono">Energy: {t12.energyUsedWh} Wh</span>}
          </div>

          <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px]">How long did 99→100% take?</span>
            <div className="font-mono font-bold text-slate-200 mt-1">
              {t99100 ? `${t99100.timeTakenSeconds}s (${t99100.formattedDuration})` : 'Pending reading'}
            </div>
            {t99100 && <span className="text-[10px] text-slate-500 font-mono">Energy: {t99100.energyUsedWh} Wh</span>}
          </div>

          <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px]">CC → CV Phase Inflection:</span>
            <div className="font-mono font-bold text-amber-300 mt-1">
              {ccCvInflection !== null ? `At ~${ccCvInflection}% Charge` : 'Linear / In Progress'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Current taper onset</span>
          </div>
        </div>
      </div>
    </div>
  );
};
