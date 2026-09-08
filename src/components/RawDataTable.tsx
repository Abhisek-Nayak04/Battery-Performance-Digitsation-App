/**
 * Raw Measurement Data Audit Table
 * Preserves raw OCR readings and timestamps with validation status.
 */

import React, { useState } from 'react';
import { Database, Download, Filter } from 'lucide-react';
import { MeasurementStatus, RawMeasurement } from '../types/charging';

interface RawDataTableProps {
  rawMeasurements: RawMeasurement[];
}

export const RawDataTable: React.FC<RawDataTableProps> = ({ rawMeasurements }) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = rawMeasurements.filter(r => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'VALID') return r.status === MeasurementStatus.VALID;
    if (statusFilter === 'FLAGGED') return r.status !== MeasurementStatus.VALID;
    return r.status === statusFilter;
  });

  const downloadRawCsv = () => {
    if (rawMeasurements.length === 0) return;
    const headers = [
      'ID', 'Session ID', 'Recording Time', 'Elapsed Time', 'Elapsed (s)',
      'Status', 'Reason', 'Raw OCR', 'Overall Conf', 'V Conf', 'A Conf', '% Conf',
      'Parsed V', 'Parsed A', 'Parsed %', 'Validated V', 'Validated A', 'Validated %', 'Source'
    ];
    const rows = rawMeasurements.map(r => [
      r.id, r.sessionId, r.recordingTime, r.elapsedTime, r.elapsedSeconds,
      r.status, `"${r.statusReason || ''}"`, `"${r.rawOcrText.replace(/\n/g, ' ')}"`,
      r.overallConfidence, r.voltageConfidence, r.currentConfidence, r.chargeConfidence,
      r.parsedVoltage ?? '', r.parsedCurrent ?? '', r.parsedCharge ?? '',
      r.voltage ?? '', r.current ?? '', r.chargePercent ?? '', 'REAL_OPTICAL'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Raw_Charging_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="raw-data-table-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            RAW CAMERA / OCR AUDIT TRAIL
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
            {rawMeasurements.length} Total Frames
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              id="raw-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1"
            >
              <option value="ALL">All Frames ({rawMeasurements.length})</option>
              <option value="VALID">Valid Only</option>
              <option value="FLAGGED">Flagged / Review Only</option>
              <option value={MeasurementStatus.NEEDS_REVIEW}>Needs Review</option>
              <option value={MeasurementStatus.SUSPICIOUS_JUMP}>Suspicious Jump</option>
              <option value={MeasurementStatus.INVALID_RANGE}>Invalid Range</option>
            </select>
          </div>

          <button
            id="export-raw-csv-btn"
            onClick={downloadRawCsv}
            disabled={rawMeasurements.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs px-2.5 py-1.5 rounded transition border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" /> Export Raw CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto max-h-96 border border-slate-800 rounded-lg">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
            <tr>
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Elapsed</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">V (V)</th>
              <th className="py-2 px-3 text-right">I (A)</th>
              <th className="py-2 px-3 text-right">Charge (%)</th>
              <th className="py-2 px-3 text-right">Conf (%)</th>
              <th className="py-2 px-3">Diagnostic Reason</th>
              <th className="py-2 px-3">Raw OCR String</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-500 font-sans">
                  No frames matching the selected criteria.
                </td>
              </tr>
            ) : (
              // Reverse to show latest measurements at top
              [...filtered].reverse().map(r => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-800/50 transition ${
                    r.status !== MeasurementStatus.VALID ? 'bg-rose-950/15 text-rose-300/90' : 'text-slate-300'
                  }`}
                >
                  <td className="py-2 px-3 text-slate-500 font-bold">{r.id}</td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{r.recordingTime}</td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{r.elapsedTime}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded font-sans font-medium ${
                        r.status === MeasurementStatus.VALID
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : r.status === MeasurementStatus.SUSPICIOUS_JUMP
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-sky-300">
                    {r.voltage !== null ? `${r.voltage.toFixed(2)}V` : r.parsedVoltage !== null ? `(${r.parsedVoltage}V)` : '--'}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-300">
                    {r.current !== null ? `${r.current.toFixed(3)}A` : r.parsedCurrent !== null ? `(${r.parsedCurrent}A)` : '--'}
                  </td>
                  <td className="py-2 px-3 text-right text-amber-300">
                    {r.chargePercent !== null ? `${r.chargePercent}%` : r.parsedCharge !== null ? `(${r.parsedCharge}%)` : '--'}
                  </td>
                  <td className="py-2 px-3 text-right text-indigo-300">{r.overallConfidence}%</td>
                  <td className="py-2 px-3 text-slate-400 max-w-xs truncate text-[11px]" title={r.statusReason}>
                    {r.statusReason || 'OK'}
                  </td>
                  <td className="py-2 px-3 text-slate-500 max-w-xs truncate text-[11px]" title={r.rawOcrText}>
                    {r.rawOcrText.replace(/\n/g, ' ')}
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
