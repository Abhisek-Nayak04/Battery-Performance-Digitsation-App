/**
 * Engineering Graphs Component (10 Mandatory Charging Graphs)
 * 1. Voltage vs Time
 * 2. Current vs Time
 * 3. Charge % vs Time
 * 4. Power vs Time
 * 5. Voltage vs Charge %
 * 6. Current vs Charge %
 * 7. Time Required per 1% vs Charge %
 * 8. Energy Used per 1% vs Charge %
 * 9. Power vs Charge %
 * 10. Cumulative Energy vs Charge %
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { LineChart as LineChartIcon, LayoutGrid } from 'lucide-react';
import { PercentageTransition, ValidMeasurement } from '../types/charging';

interface GraphsViewProps {
  validMeasurements: ValidMeasurement[];
  transitions: PercentageTransition[];
}

export const GraphsView: React.FC<GraphsViewProps> = ({ validMeasurements, transitions }) => {
  const [activeTab, setActiveTab] = useState<'all' | number>(1);

  // Downsample time series data if there are over 400 points to keep chart rendering smooth
  const chartData = React.useMemo(() => {
    if (validMeasurements.length <= 300) {
      return validMeasurements.map(m => ({
        time: m.elapsedTime,
        seconds: m.elapsedSeconds,
        voltage: m.voltage,
        current: m.current,
        chargePercent: m.chargePercent,
        power: m.power,
        cumulativeEnergyWh: m.cumulativeEnergyWh,
        cumulativeChargeAh: m.cumulativeChargeAh,
      }));
    }

    const step = Math.ceil(validMeasurements.length / 300);
    const sampled = [];
    for (let i = 0; i < validMeasurements.length; i += step) {
      const m = validMeasurements[i];
      sampled.push({
        time: m.elapsedTime,
        seconds: m.elapsedSeconds,
        voltage: m.voltage,
        current: m.current,
        chargePercent: m.chargePercent,
        power: m.power,
        cumulativeEnergyWh: m.cumulativeEnergyWh,
        cumulativeChargeAh: m.cumulativeChargeAh,
      });
    }
    // Always include the latest measurement
    const last = validMeasurements[validMeasurements.length - 1];
    sampled.push({
      time: last.elapsedTime,
      seconds: last.elapsedSeconds,
      voltage: last.voltage,
      current: last.current,
      chargePercent: last.chargePercent,
      power: last.power,
      cumulativeEnergyWh: last.cumulativeEnergyWh,
      cumulativeChargeAh: last.cumulativeChargeAh,
    });
    return sampled;
  }, [validMeasurements]);

  // Transition data for 1% charts (time per 1%, energy per 1%)
  const transitionData = React.useMemo(() => {
    return transitions.map(t => ({
      chargeLabel: `${t.fromCharge}→${t.toCharge}%`,
      chargePct: t.toCharge,
      timeSeconds: t.timeTakenSeconds,
      energyWh: t.energyUsedWh,
      avgV: t.averageVoltage,
      avgA: t.averageCurrent,
      avgW: t.averagePower,
    }));
  }, [transitions]);

  const graphDefinitions = [
    {
      id: 1,
      title: '1. Voltage vs Time',
      type: 'time',
      yKey: 'voltage',
      stroke: '#38bdf8',
      unit: 'V',
      yDomain: ['auto', 'auto'],
    },
    {
      id: 2,
      title: '2. Current vs Time',
      type: 'time',
      yKey: 'current',
      stroke: '#34d399',
      unit: 'A',
      yDomain: [0, 'auto'],
    },
    {
      id: 3,
      title: '3. Charge % vs Time',
      type: 'time',
      yKey: 'chargePercent',
      stroke: '#fbbf24',
      unit: '%',
      yDomain: [0, 100],
    },
    {
      id: 4,
      title: '4. Power vs Time',
      type: 'time',
      yKey: 'power',
      stroke: '#f43f5e',
      unit: 'W',
      yDomain: [0, 'auto'],
    },
    {
      id: 5,
      title: '5. Voltage vs Charge %',
      type: 'charge',
      xKey: 'chargePercent',
      yKey: 'voltage',
      stroke: '#38bdf8',
      unit: 'V',
      yDomain: ['auto', 'auto'],
    },
    {
      id: 6,
      title: '6. Current vs Charge %',
      type: 'charge',
      xKey: 'chargePercent',
      yKey: 'current',
      stroke: '#34d399',
      unit: 'A',
      yDomain: [0, 'auto'],
    },
    {
      id: 7,
      title: '7. Time Required per 1% vs Charge %',
      type: 'transition-bar',
      xKey: 'chargeLabel',
      yKey: 'timeSeconds',
      fill: '#a855f7',
      unit: 's',
    },
    {
      id: 8,
      title: '8. Energy Used per 1% vs Charge %',
      type: 'transition-bar',
      xKey: 'chargeLabel',
      yKey: 'energyWh',
      fill: '#06b6d4',
      unit: 'Wh',
    },
    {
      id: 9,
      title: '9. Power vs Charge %',
      type: 'charge',
      xKey: 'chargePercent',
      yKey: 'power',
      stroke: '#f97316',
      unit: 'W',
      yDomain: [0, 'auto'],
    },
    {
      id: 10,
      title: '10. Cumulative Energy vs Charge %',
      type: 'charge',
      xKey: 'chargePercent',
      yKey: 'cumulativeEnergyWh',
      stroke: '#ec4899',
      unit: 'Wh',
      yDomain: [0, 'auto'],
    },
  ];

  const renderSingleChart = (g: typeof graphDefinitions[0], height = 240) => {
    if (g.type === 'transition-bar') {
      if (transitionData.length === 0) {
        return (
          <div className="h-44 flex items-center justify-center text-xs text-slate-500 font-mono">
            Awaiting 1% percentage transitions...
          </div>
        );
      }
      return (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={transitionData} margin={{ top: 8, right: 12, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={g.xKey} stroke="#64748b" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                formatter={(val: any) => [`${val} ${g.unit}`, g.title.split('. ')[1]]}
              />
              <Bar dataKey={g.yKey} fill={g.fill} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-slate-500 font-mono">
          Awaiting validated telemetry points...
        </div>
      );
    }

    const xDataKey = g.type === 'time' ? 'time' : 'chargePercent';

    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey={xDataKey}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              unit={g.type === 'charge' ? '%' : ''}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              domain={g.yDomain as any}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
              formatter={(val: any) => [`${val} ${g.unit}`, g.title.split('. ')[1]]}
            />
            <Line
              type="monotone"
              dataKey={g.yKey}
              stroke={g.stroke}
              strokeWidth={2}
              dot={chartData.length < 30}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div id="engineering-graphs-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            CHARGING PERFORMANCE GRAPHS (10 REQUIRED ENGINEERING SERIES)
          </h2>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
          <button
            id="tab-all-charts"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Grid (All 10)
          </button>
          {graphDefinitions.map(g => (
            <button
              key={g.id}
              id={`tab-graph-${g.id}`}
              onClick={() => setActiveTab(g.id)}
              className={`text-xs px-2 py-1 rounded font-mono transition whitespace-nowrap ${
                activeTab === g.id
                  ? 'bg-slate-700 text-slate-100 border border-slate-600 font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              #{g.id}
            </button>
          ))}
        </div>
      </div>

      {/* Content: Either All 10 in a 2-column Grid or Single Detailed Focus View */}
      {activeTab === 'all' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {graphDefinitions.map(g => (
            <div key={g.id} className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>{g.title}</span>
                <span className="font-mono text-[10px] text-slate-500">{g.unit}</span>
              </div>
              {renderSingleChart(g, 200)}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-lg flex flex-col gap-3">
          {(() => {
            const currentDef = graphDefinitions.find(g => g.id === activeTab) || graphDefinitions[0];
            return (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-200">{currentDef.title}</h3>
                  <span className="text-xs font-mono text-indigo-400">Engineering Unit: {currentDef.unit}</span>
                </div>
                {renderSingleChart(currentDef, 360)}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
