/**
 * Automated Verification Test Suite Modal
 * Executes Tests 1 through 18 as described in Section 28 of the specification.
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Play, RefreshCw, X, Award } from 'lucide-react';
import { AutomatedTestSuite, TestResultItem } from '../services/testSuite';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResultItem[]>([]);
  const [hasRun, setHasRun] = useState(false);

  if (!isOpen) return null;

  const runTests = async () => {
    setIsRunning(true);
    try {
      const res = await AutomatedTestSuite.runAllTests();
      setResults(res);
      setHasRun(true);
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        id="test-suite-modal"
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Automated System Verification Suite (Tests 1 – 18)
              </h2>
              <p className="text-xs text-slate-400">
                Rigorous mathematical and pipeline testing matching Section 28 specification.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Status Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              id="execute-test-suite-btn"
              onClick={runTests}
              disabled={isRunning}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-[0_0_12px_rgba(99,102,241,0.3)]"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Running Verification Suite...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Run 18 Tests Now
                </>
              )}
            </button>

            {hasRun && (
              <div className="text-xs font-mono">
                <span className="text-emerald-400 font-bold">{passCount} Passed</span> /{' '}
                <span className={totalCount - passCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {totalCount - passCount} Failed
                </span>{' '}
                ({totalCount} Total)
              </div>
            )}
          </div>

          {hasRun && passCount === 18 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>100% Core Requirements Verified (18/18 Tests Passed)</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {!hasRun ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Press &quot;Run 18 Tests Now&quot; above to execute automated unit and integration tests across the hardware, computer vision, OCR, time tracking, electrical formulas, 1% transition logic, and Excel workbook generator.
            </div>
          ) : (
            results.map(r => (
              <div
                key={r.id}
                className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 transition ${
                  r.passed
                    ? 'bg-slate-950/70 border-emerald-900/60 text-slate-200'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold">{r.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {r.category}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-sans pl-6">
                  {r.message}
                </div>

                {r.details && (
                  <pre className="mt-1 ml-6 p-2 rounded bg-black/60 border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
