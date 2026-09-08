/**
 * Session Control Bar Component
 * Manages test start/stop, mode switching (Real Camera vs Demo), sampling interval,
 * configuration parameters, and export actions.
 */

import React, { useState } from 'react';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Settings,
  FileSpreadsheet,
  Camera,
  Video,
  Award,
  Zap,
} from 'lucide-react';
import { SystemMode, ValidationConfig } from '../types/charging';

interface SessionControlBarProps {
  sessionId: string;
  isSessionActive: boolean;
  isPaused: boolean;
  mode: SystemMode;
  onModeChange: (mode: SystemMode) => void;
  onStartSession: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStopSession: () => void;
  onResetSession: () => void;
  onGenerateFullDemo?: () => void;
  samplingIntervalMs: number;
  onSamplingIntervalChange: (ms: number) => void;
  validationConfig: ValidationConfig;
  onValidationConfigChange: (config: ValidationConfig) => void;
  onOpenTestSuite: () => void;
  onExportExcel: () => void;
  validCount: number;
  frameCount: number;
}

export const SessionControlBar: React.FC<SessionControlBarProps> = ({
  sessionId,
  isSessionActive,
  isPaused,
  mode,
  onModeChange,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onStopSession,
  onResetSession,
  onGenerateFullDemo,
  samplingIntervalMs,
  onSamplingIntervalChange,
  validationConfig,
  onValidationConfigChange,
  onOpenTestSuite,
  onExportExcel,
  validCount,
  frameCount,
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempConfig, setTempConfig] = useState<ValidationConfig>(validationConfig);

  const handleSaveConfig = () => {
    onValidationConfigChange(tempConfig);
    setShowConfigModal(false);
  };

  return (
    <>
      <div
        id="session-control-bar"
        className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg"
      >
        {/* Left: Mode Toggle & Session ID */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real Input Source Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="mode-real-camera-btn"
              onClick={() => onModeChange(SystemMode.REAL_CAMERA)}
              disabled={isSessionActive}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition ${
                mode === SystemMode.REAL_CAMERA
                  ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Live Camera
            </button>
            <button
              id="mode-real-video-btn"
              onClick={() => onModeChange(SystemMode.REAL_VIDEO_FILE)}
              disabled={isSessionActive}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition ${
                mode === SystemMode.REAL_VIDEO_FILE
                  ? 'bg-sky-600 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Recorded Video
            </button>
          </div>

          {/* Session ID Badge */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono text-slate-300">
            <span className="text-slate-500 font-sans">Session:</span>
            <span className="text-sky-300 font-bold">{sessionId}</span>
          </div>

          {/* Counts */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Valid: <strong className="text-emerald-400">{validCount}</strong></span>
            <span>/</span>
            <span>Frames: <strong className="text-slate-200">{frameCount}</strong></span>
          </div>
        </div>

        {/* Center: Session Execution Controls */}
        <div className="flex items-center gap-2">
          {!isSessionActive ? (
            <button
              id="start-session-btn"
              onClick={onStartSession}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <Play className="w-4 h-4 fill-current" /> Start Test
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  id="resume-session-btn"
                  onClick={onResumeSession}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg transition"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume
                </button>
              ) : (
                <button
                  id="pause-session-btn"
                  onClick={onPauseSession}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition border border-slate-700"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}

              <button
                id="stop-session-btn"
                onClick={onStopSession}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-[0_0_12px_rgba(244,63,94,0.3)]"
              >
                <Square className="w-4 h-4 fill-current" /> Stop &amp; Finalize
              </button>
            </>
          )}

          <button
            id="reset-session-btn"
            onClick={onResetSession}
            title="Reset and start clean session"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition border border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Quick Tools & Config */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sampling Interval Selector */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
            <span className="text-[11px]">Interval:</span>
            <select
              id="sampling-interval-select"
              value={samplingIntervalMs}
              onChange={e => onSamplingIntervalChange(Number(e.target.value))}
              disabled={isSessionActive}
              className="bg-transparent text-slate-200 text-xs font-mono outline-none cursor-pointer"
            >
              <option value={250}>250 ms (4 Hz)</option>
              <option value={500}>500 ms (2 Hz)</option>
              <option value={1000}>1000 ms (1 Hz - Default)</option>
              <option value={2000}>2000 ms (0.5 Hz)</option>
              <option value={5000}>5000 ms (0.2 Hz)</option>
            </select>
          </div>

          {/* Verification Test Suite (18 Tests) */}
          <button
            id="open-test-suite-modal-btn"
            onClick={onOpenTestSuite}
            className="flex items-center gap-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs px-2.5 py-1.5 rounded-lg transition"
          >
            <Award className="w-3.5 h-3.5 text-indigo-400" /> Tests 1–18
          </button>

          {/* Config Settings Button */}
          <button
            id="open-validation-config-btn"
            onClick={() => {
              setTempConfig(validationConfig);
              setShowConfigModal(true);
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
            title="Configure Validation Ranges & Thresholds"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Excel Export Button */}
          <button
            id="export-excel-bar-btn"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export XLSX
          </button>
        </div>
      </div>

      {/* Validation Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-5 flex flex-col gap-4 text-xs animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" /> Validation &amp; Physical Limits Configuration
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Min Voltage (V):</label>
                <input
                  type="number"
                  value={tempConfig.minVoltage}
                  onChange={e => setTempConfig({ ...tempConfig, minVoltage: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Voltage (V):</label>
                <input
                  type="number"
                  value={tempConfig.maxVoltage}
                  onChange={e => setTempConfig({ ...tempConfig, maxVoltage: parseFloat(e.target.value) || 300 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Min Current (A):</label>
                <input
                  type="number"
                  value={tempConfig.minCurrent}
                  onChange={e => setTempConfig({ ...tempConfig, minCurrent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Current (A):</label>
                <input
                  type="number"
                  value={tempConfig.maxCurrent}
                  onChange={e => setTempConfig({ ...tempConfig, maxCurrent: parseFloat(e.target.value) || 50 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Min OCR Confidence (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tempConfig.minConfidence}
                  onChange={e => setTempConfig({ ...tempConfig, minConfidence: parseInt(e.target.value) || 80 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max ΔV Jump Limit (V/s):</label>
                <input
                  type="number"
                  value={tempConfig.maxVoltageJump}
                  onChange={e => setTempConfig({ ...tempConfig, maxVoltageJump: parseFloat(e.target.value) || 15 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max ΔA Jump Limit (A/s):</label>
                <input
                  type="number"
                  value={tempConfig.maxCurrentJump}
                  onChange={e => setTempConfig({ ...tempConfig, maxCurrentJump: parseFloat(e.target.value) || 10 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Δ% Jump Limit (%/s):</label>
                <input
                  type="number"
                  value={tempConfig.maxChargeJump}
                  onChange={e => setTempConfig({ ...tempConfig, maxChargeJump: parseFloat(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="allow-negative-current-cb"
                type="checkbox"
                checked={tempConfig.allowNegativeCurrent}
                onChange={e => setTempConfig({ ...tempConfig, allowNegativeCurrent: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-sky-500"
              />
              <label htmlFor="allow-negative-current-cb" className="text-slate-300 cursor-pointer">
                Allow Negative Current (Bidirectional / Discharge testing)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded bg-sky-600 text-white font-bold hover:bg-sky-500 transition"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
