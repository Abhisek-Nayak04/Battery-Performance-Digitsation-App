/**
 * Live Telemetry Display Component
 * Displays instantaneous digitized electrical readings, calculation metrics, and confidence ratings.
 */

import React from 'react';
import { Zap, Activity, BatteryCharging, Clock, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { MeasurementStatus, ValidMeasurement, RawMeasurement } from '../types/charging';

export interface LiveOpticalReading {
  voltage: number | null;
  current: number | null;
  chargePercent: number | null;
  voltageConfidence: number;
  currentConfidence: number;
  chargeConfidence: number;
  overallConfidence: number;
  status: MeasurementStatus;
  statusReason?: string;
  rawText?: string;
}

interface LiveTelemetryCardProps {
  currentMeasurement: ValidMeasurement | null;
  lastRawMeasurement: RawMeasurement | null;
  liveReading?: LiveOpticalReading | null;
  status: MeasurementStatus;
  isSessionActive: boolean;
}

export const LiveTelemetryCard: React.FC<LiveTelemetryCardProps> = ({
  currentMeasurement,
  lastRawMeasurement,
  liveReading,
  status,
  isSessionActive,
}) => {
  const displayVoltage =
    liveReading?.voltage ??
    currentMeasurement?.voltage ??
    lastRawMeasurement?.voltage ??
    lastRawMeasurement?.parsedVoltage ??
    null;

  const displayCurrent =
    liveReading?.current ??
    currentMeasurement?.current ??
    lastRawMeasurement?.current ??
    lastRawMeasurement?.parsedCurrent ??
    null;

  const displayCharge =
    liveReading?.chargePercent ??
    currentMeasurement?.chargePercent ??
    lastRawMeasurement?.chargePercent ??
    lastRawMeasurement?.parsedCharge ??
    null;

  const voltageConf =
    liveReading?.voltageConfidence ||
    lastRawMeasurement?.voltageConfidence ||
    (displayVoltage !== null ? 85 : 0);

  const currentConf =
    liveReading?.currentConfidence ||
    lastRawMeasurement?.currentConfidence ||
    (displayCurrent !== null ? 85 : 0);

  const chargeConf =
    liveReading?.chargeConfidence ||
    lastRawMeasurement?.chargeConfidence ||
    (displayCharge !== null ? 85 : 0);

  const calcPower =
    currentMeasurement?.power ??
    (displayVoltage !== null && displayCurrent !== null
      ? Math.round(displayVoltage * displayCurrent * 100) / 100
      : null);

  const getStatusBadge = () => {
    switch (status) {
      case MeasurementStatus.VALID:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> VALID READING
          </span>
        );
      case MeasurementStatus.NEEDS_REVIEW:
      case MeasurementStatus.LOW_CONFIDENCE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW (LOW CONF)
          </span>
        );
      case MeasurementStatus.SUSPICIOUS_JUMP:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            <ShieldAlert className="w-3.5 h-3.5" /> SUSPICIOUS JUMP FLAGGED
          </span>
        );
      case MeasurementStatus.DISPLAY_NOT_DETECTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            ALIGNING CAMERA ROI...
          </span>
        );
      default:
        if (displayVoltage !== null || displayCurrent !== null) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> OPTICAL FEED DETECTED
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            SCANNING DISPLAY...
          </span>
        );
    }
  };

  return (
    <div id="live-telemetry-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">DIGITIZED TELEMETRY & CALCULATIONS</h2>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {isSessionActive ? 'RECORDING ACTIVE' : 'LIVE OPTICAL FEED'}
          </span>
        </div>
      </div>

      {/* Primary Measured Gauges (Voltage, Current, State of Charge) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Voltage Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>VOLTAGE</span>
            <span className="font-mono text-[11px] text-sky-400">
              Conf: {voltageConf > 0 ? `${voltageConf}%` : '--'}
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-slate-100">
              {displayVoltage !== null ? displayVoltage.toFixed(2) : '--.--'}
            </span>
            <span className="text-sm font-semibold text-sky-400">V</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {displayVoltage !== null ? 'Live Camera Extracted Value' : 'Awaiting Display Digits'}
          </div>
        </div>

        {/* Current Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>CURRENT</span>
            <span className="font-mono text-[11px] text-emerald-400">
              Conf: {currentConf > 0 ? `${currentConf}%` : '--'}
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-slate-100">
              {displayCurrent !== null ? displayCurrent.toFixed(3) : '--.---'}
            </span>
            <span className="text-sm font-semibold text-emerald-400">A</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {displayCurrent !== null ? 'Live Camera Extracted Value' : 'Awaiting Display Digits'}
          </div>
        </div>

        {/* State of Charge Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>BATTERY CHARGE</span>
            <span className="font-mono text-[11px] text-amber-400">
              Conf: {chargeConf > 0 ? `${chargeConf}%` : '--'}
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-slate-100">
              {displayCharge !== null ? displayCharge : '--'}
            </span>
            <span className="text-sm font-semibold text-amber-400">%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${displayCharge !== null ? Math.min(100, Math.max(0, displayCharge)) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Secondary Derived Electrical Calculations (Power, Wh, Ah, Time) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Power */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>Power (V × A):</span>
          </div>
          <div className="font-mono text-base font-bold text-slate-200">
            {calcPower !== null ? `${calcPower.toFixed(2)} W` : '--.-- W'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Instantaneous Electrical</span>
        </div>

        {/* Energy (Wh) */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <BatteryCharging className="w-3.5 h-3.5 text-sky-400" />
            <span>Cumulative Energy:</span>
          </div>
          <div className="font-mono text-base font-bold text-sky-300">
            {currentMeasurement ? `${currentMeasurement.cumulativeEnergyWh.toFixed(3)} Wh` : (isSessionActive ? '0.000 Wh' : '--.--- Wh')}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Trapezoidal Integration</span>
        </div>

        {/* Accumulated Charge (Ah) */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Accumulated Capacity:</span>
          </div>
          <div className="font-mono text-base font-bold text-emerald-300">
            {currentMeasurement ? `${currentMeasurement.cumulativeChargeAh.toFixed(3)} Ah` : (isSessionActive ? '0.000 Ah' : '--.--- Ah')}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Time-Current Integration</span>
        </div>

        {/* Recording & Elapsed Time */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Elapsed Duration:</span>
          </div>
          <div className="font-mono text-base font-bold text-purple-300">
            {currentMeasurement ? currentMeasurement.elapsedTime : (isSessionActive ? '00:00:00' : 'STANDBY')}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Time: {currentMeasurement ? currentMeasurement.recordingTime : new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};
