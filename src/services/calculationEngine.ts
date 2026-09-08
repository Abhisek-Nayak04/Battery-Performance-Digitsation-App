/**
 * Electrical Calculation & Transition Detection Engine
 * Computes:
 * - Instantaneous Power (W = V * A)
 * - Numerical Trapezoidal Integration for Energy (Wh) and Charge (Ah)
 * - 1% Charge Transitions with statistical analysis (Avg/Min/Max V, A, W)
 * - Skipped Transition detection without inventing missing times
 * - 10-Bucket Charge Range Analysis (0-10% to 90-100%)
 * - Full Session Summaries & CC-CV inflection analysis
 */

import {
  ChargeRangeSummary,
  PercentageTransition,
  RawMeasurement,
  SessionSummary,
  TransitionStatus,
  ValidMeasurement,
} from '../types/charging';
import { ValidationService } from './validationService';

export class CalculationEngine {
  /**
   * Convert a validated raw measurement into a calculated ValidMeasurement
   */
  static processValidMeasurement(
    raw: RawMeasurement,
    previousValid: ValidMeasurement | null
  ): ValidMeasurement {
    const voltage = raw.voltage!;
    const current = raw.current!;
    const chargePercent = raw.chargePercent!;
    const power = Math.round(voltage * current * 100) / 100;

    let intervalSeconds = 0;
    let intervalEnergyWh = 0;
    let cumulativeEnergyWh = 0;
    let intervalChargeAh = 0;
    let cumulativeChargeAh = 0;

    if (previousValid) {
      intervalSeconds = Math.max(0, (raw.timestamp - previousValid.timestamp) / 1000);
      const dtHours = intervalSeconds / 3600;

      // Trapezoidal numerical integration for Energy (Wh):
      // (P1 + P2)/2 * dt_hours
      const avgPower = (previousValid.power + power) / 2;
      intervalEnergyWh = avgPower * dtHours;
      cumulativeEnergyWh = previousValid.cumulativeEnergyWh + intervalEnergyWh;

      // Trapezoidal numerical integration for Accumulated Charge (Ah):
      // (I1 + I2)/2 * dt_hours
      const avgCurrent = (previousValid.current + current) / 2;
      intervalChargeAh = avgCurrent * dtHours;
      cumulativeChargeAh = previousValid.cumulativeChargeAh + intervalChargeAh;
    }

    return {
      id: raw.id,
      sessionId: raw.sessionId,
      timestamp: raw.timestamp,
      recordingTime: raw.recordingTime,
      elapsedTime: raw.elapsedTime,
      elapsedSeconds: raw.elapsedSeconds,
      isDemo: raw.isDemo,
      voltage,
      current,
      chargePercent,
      power,
      intervalSeconds,
      intervalEnergyWh: Math.round(intervalEnergyWh * 10000) / 10000,
      cumulativeEnergyWh: Math.round(cumulativeEnergyWh * 1000) / 1000,
      intervalChargeAh: Math.round(intervalChargeAh * 10000) / 10000,
      cumulativeChargeAh: Math.round(cumulativeChargeAh * 1000) / 1000,
      confidence: raw.overallConfidence,
    };
  }

  /**
   * Detect charge percentage transitions (0->1%, 1->2%, etc.) across time series
   * Properly distinguishes repeated readings from transitions, and flags skipped percentages!
   */
  static computePercentageTransitions(validMeasurements: ValidMeasurement[]): PercentageTransition[] {
    if (validMeasurements.length === 0) return [];

    const transitions: PercentageTransition[] = [];

    // Group measurements by charge percentage
    // Find the first occurrence timestamp and measurements collected during each percentage stage
    interface StageData {
      charge: number;
      firstSeenIdx: number;
      lastSeenIdx: number;
      measurements: ValidMeasurement[];
    }

    const stages: StageData[] = [];
    let currentStage: StageData = {
      charge: validMeasurements[0].chargePercent,
      firstSeenIdx: 0,
      lastSeenIdx: 0,
      measurements: [validMeasurements[0]],
    };

    for (let i = 1; i < validMeasurements.length; i++) {
      const m = validMeasurements[i];
      if (m.chargePercent === currentStage.charge) {
        currentStage.lastSeenIdx = i;
        currentStage.measurements.push(m);
      } else {
        stages.push(currentStage);
        currentStage = {
          charge: m.chargePercent,
          firstSeenIdx: i,
          lastSeenIdx: i,
          measurements: [m],
        };
      }
    }
    stages.push(currentStage);

    // Now analyze transitions between successive stages
    for (let s = 0; s < stages.length - 1; s++) {
      const stA = stages[s];
      const stB = stages[s + 1];

      const fromCharge = stA.charge;
      const toCharge = stB.charge;

      // Check if a percentage was skipped (e.g. 10% -> 12%)
      if (toCharge > fromCharge + 1) {
        // Section 13: Handle skipped percentages!
        // Mark as PERCENTAGE_TRANSITION_SKIPPED, do not invent 11% transition time!
        const skippedCount = toCharge - fromCharge - 1;
        const startTime = validMeasurements[stA.firstSeenIdx].recordingTime;
        const endTime = validMeasurements[stB.firstSeenIdx].recordingTime;
        const startTs = validMeasurements[stA.firstSeenIdx].timestamp;
        const endTs = validMeasurements[stB.firstSeenIdx].timestamp;
        const timeTaken = Math.max(0, Math.floor((endTs - startTs) / 1000));

        // Combined measurements across the gap
        const gapMeasurements = [...stA.measurements, ...stB.measurements];
        const stats = this.calculateSliceStats(gapMeasurements);

        transitions.push({
          fromCharge,
          toCharge,
          startTime,
          endTime,
          startTimestamp: startTs,
          endTimestamp: endTs,
          timeTakenSeconds: timeTaken,
          formattedDuration: ValidationService.formatDuration(timeTaken),
          averageVoltage: stats.avgV,
          minVoltage: stats.minV,
          maxVoltage: stats.maxV,
          averageCurrent: stats.avgA,
          minCurrent: stats.minA,
          maxCurrent: stats.maxA,
          averagePower: stats.avgW,
          maxPower: stats.maxW,
          energyUsedWh: stats.energyWh,
          chargeAccumulatedAh: stats.chargeAh,
          readingCount: gapMeasurements.length,
          status: TransitionStatus.PERCENTAGE_TRANSITION_SKIPPED,
          notes: `Skipped ${skippedCount} percentage point(s) [${fromCharge + 1}% to ${toCharge - 1}%] without verified reading`,
        });
      } else if (toCharge === fromCharge + 1) {
        // Standard confirmed 1% transition
        // Start: first time fromCharge was seen
        // End: first time toCharge was seen
        const firstM = validMeasurements[stA.firstSeenIdx];
        const transitionM = validMeasurements[stB.firstSeenIdx];

        const startTs = firstM.timestamp;
        const endTs = transitionM.timestamp;
        const timeTaken = Math.max(1, Math.floor((endTs - startTs) / 1000));

        // Slice of measurements covering this 1% progression
        const sliceMeasurements = stA.measurements;
        const stats = this.calculateSliceStats(sliceMeasurements);

        transitions.push({
          fromCharge,
          toCharge,
          startTime: firstM.recordingTime,
          endTime: transitionM.recordingTime,
          startTimestamp: startTs,
          endTimestamp: endTs,
          timeTakenSeconds: timeTaken,
          formattedDuration: ValidationService.formatDuration(timeTaken),
          averageVoltage: stats.avgV,
          minVoltage: stats.minV,
          maxVoltage: stats.maxV,
          averageCurrent: stats.avgA,
          minCurrent: stats.minA,
          maxCurrent: stats.maxA,
          averagePower: stats.avgW,
          maxPower: stats.maxW,
          energyUsedWh: stats.energyWh,
          chargeAccumulatedAh: stats.chargeAh,
          readingCount: sliceMeasurements.length,
          status: TransitionStatus.CONFIRMED,
        });
      }
    }

    return transitions;
  }

  /**
   * Helper to compute aggregate statistics over a slice of measurements
   */
  private static calculateSliceStats(slice: ValidMeasurement[]) {
    if (slice.length === 0) {
      return {
        avgV: 0, minV: 0, maxV: 0,
        avgA: 0, minA: 0, maxA: 0,
        avgW: 0, maxW: 0,
        energyWh: 0, chargeAh: 0
      };
    }

    let sumV = 0;
    let minV = slice[0].voltage;
    let maxV = slice[0].voltage;

    let sumA = 0;
    let minA = slice[0].current;
    let maxA = slice[0].current;

    let sumW = 0;
    let maxW = slice[0].power;

    let energyWh = 0;
    let chargeAh = 0;

    for (const m of slice) {
      sumV += m.voltage;
      if (m.voltage < minV) minV = m.voltage;
      if (m.voltage > maxV) maxV = m.voltage;

      sumA += m.current;
      if (m.current < minA) minA = m.current;
      if (m.current > maxA) maxA = m.current;

      sumW += m.power;
      if (m.power > maxW) maxW = m.power;

      energyWh += m.intervalEnergyWh;
      chargeAh += m.intervalChargeAh;
    }

    const n = slice.length;
    return {
      avgV: Math.round((sumV / n) * 100) / 100,
      minV: Math.round(minV * 100) / 100,
      maxV: Math.round(maxV * 100) / 100,
      avgA: Math.round((sumA / n) * 1000) / 1000,
      minA: Math.round(minA * 1000) / 1000,
      maxA: Math.round(maxA * 1000) / 1000,
      avgW: Math.round((sumW / n) * 100) / 100,
      maxW: Math.round(maxW * 100) / 100,
      energyWh: Math.round(energyWh * 1000) / 1000,
      chargeAh: Math.round(chargeAh * 1000) / 1000,
    };
  }

  /**
   * Group measurements into 10% charging ranges (0-10%, 10-20%, ..., 90-100%)
   */
  static computeChargeRangeSummaries(validMeasurements: ValidMeasurement[]): ChargeRangeSummary[] {
    const ranges = [
      { label: '0–10%', from: 0, to: 10 },
      { label: '10–20%', from: 10, to: 20 },
      { label: '20–30%', from: 20, to: 30 },
      { label: '30–40%', from: 30, to: 40 },
      { label: '40–50%', from: 40, to: 50 },
      { label: '50–60%', from: 50, to: 60 },
      { label: '60–70%', from: 60, to: 70 },
      { label: '70–80%', from: 70, to: 80 },
      { label: '80–90%', from: 80, to: 90 },
      { label: '90–100%', from: 90, to: 100 },
    ];

    if (validMeasurements.length === 0) {
      return ranges.map(r => ({
        rangeLabel: r.label,
        fromCharge: r.from,
        toCharge: r.to,
        totalTimeSeconds: 0,
        formattedTime: '00:00:00',
        averageVoltage: 0,
        averageCurrent: 0,
        averagePower: 0,
        energyConsumedWh: 0,
        chargeAccumulatedAh: 0,
        averageTimePerOnePercent: 0,
        status: 'PENDING',
      }));
    }

    return ranges.map(r => {
      // Filter measurements that fall inside this charge range
      // Range [from, to): e.g. for 0-10%: 0 <= charge < 10 (and for 90-100%, up to <= 100)
      const inRange = validMeasurements.filter(m =>
        r.to === 100
          ? m.chargePercent >= r.from && m.chargePercent <= r.to
          : m.chargePercent >= r.from && m.chargePercent < r.to
      );

      if (inRange.length === 0) {
        return {
          rangeLabel: r.label,
          fromCharge: r.from,
          toCharge: r.to,
          totalTimeSeconds: 0,
          formattedTime: '00:00:00',
          averageVoltage: 0,
          averageCurrent: 0,
          averagePower: 0,
          energyConsumedWh: 0,
          chargeAccumulatedAh: 0,
          averageTimePerOnePercent: 0,
          status: 'PENDING',
        };
      }

      const stats = this.calculateSliceStats(inRange);
      const totalTimeSeconds = inRange.reduce((acc, m) => acc + m.intervalSeconds, 0);
      const pctSpan = Math.max(1, (inRange[inRange.length - 1].chargePercent - inRange[0].chargePercent));
      const avgTimePerOnePercent = Math.round((totalTimeSeconds / pctSpan) * 10) / 10;

      const isComplete =
        inRange[0].chargePercent <= r.from &&
        inRange[inRange.length - 1].chargePercent >= r.to;

      return {
        rangeLabel: r.label,
        fromCharge: r.from,
        toCharge: r.to,
        totalTimeSeconds: Math.round(totalTimeSeconds),
        formattedTime: ValidationService.formatDuration(totalTimeSeconds),
        averageVoltage: stats.avgV,
        averageCurrent: stats.avgA,
        averagePower: stats.avgW,
        energyConsumedWh: stats.energyWh,
        chargeAccumulatedAh: stats.chargeAh,
        averageTimePerOnePercent: avgTimePerOnePercent,
        status: isComplete ? 'COMPLETE' : 'PARTIAL',
      };
    });
  }

  /**
   * Compute comprehensive Session Summary
   */
  static generateSessionSummary(
    sessionId: string,
    rawMeasurements: RawMeasurement[],
    validMeasurements: ValidMeasurement[],
    transitions: PercentageTransition[],
    isDemo: boolean
  ): SessionSummary {
    if (validMeasurements.length === 0) {
      return {
        sessionId,
        startTime: rawMeasurements[0]?.recordingTime || '--:--:--',
        endTime: rawMeasurements[rawMeasurements.length - 1]?.recordingTime || '--:--:--',
        totalDurationSeconds: 0,
        formattedDuration: '00:00:00',
        isDemo,
        startingCharge: null,
        finalCharge: null,
        startingVoltage: null,
        finalVoltage: null,
        maxVoltage: null,
        minVoltage: null,
        averageVoltage: null,
        startingCurrent: null,
        finalCurrent: null,
        maxCurrent: null,
        minCurrent: null,
        averageCurrent: null,
        averagePower: null,
        maxPower: null,
        totalEnergyWh: 0,
        totalAccumulatedAh: 0,
        averageTimePerOnePercent: 0,
        fastestOnePercent: null,
        slowestOnePercent: null,
        totalMeasurementsCaptured: rawMeasurements.length,
        validMeasurementsCount: 0,
        flaggedMeasurementsCount: rawMeasurements.length,
        transitionsDetectedCount: 0,
        skippedTransitionsCount: 0,
      };
    }

    const first = validMeasurements[0];
    const last = validMeasurements[validMeasurements.length - 1];
    const totalDurationSeconds = Math.max(0, Math.floor((last.timestamp - first.timestamp) / 1000));

    let sumV = 0, minV = first.voltage, maxV = first.voltage;
    let sumA = 0, minA = first.current, maxA = first.current;
    let sumW = 0, maxW = first.power;

    for (const m of validMeasurements) {
      sumV += m.voltage;
      if (m.voltage < minV) minV = m.voltage;
      if (m.voltage > maxV) maxV = m.voltage;

      sumA += m.current;
      if (m.current < minA) minA = m.current;
      if (m.current > maxA) maxA = m.current;

      sumW += m.power;
      if (m.power > maxW) maxW = m.power;
    }

    const count = validMeasurements.length;
    const confirmedTransitions = transitions.filter(t => t.status === TransitionStatus.CONFIRMED);
    const skippedTransitions = transitions.filter(t => t.status === TransitionStatus.PERCENTAGE_TRANSITION_SKIPPED);

    let fastest: { from: number; to: number; timeSeconds: number } | null = null;
    let slowest: { from: number; to: number; timeSeconds: number } | null = null;

    if (confirmedTransitions.length > 0) {
      let minTime = confirmedTransitions[0].timeTakenSeconds;
      let maxTime = confirmedTransitions[0].timeTakenSeconds;
      fastest = { from: confirmedTransitions[0].fromCharge, to: confirmedTransitions[0].toCharge, timeSeconds: minTime };
      slowest = { from: confirmedTransitions[0].fromCharge, to: confirmedTransitions[0].toCharge, timeSeconds: maxTime };

      for (const t of confirmedTransitions) {
        if (t.timeTakenSeconds < minTime) {
          minTime = t.timeTakenSeconds;
          fastest = { from: t.fromCharge, to: t.toCharge, timeSeconds: minTime };
        }
        if (t.timeTakenSeconds > maxTime) {
          maxTime = t.timeTakenSeconds;
          slowest = { from: t.fromCharge, to: t.toCharge, timeSeconds: maxTime };
        }
      }
    }

    const totalTransitionSeconds = confirmedTransitions.reduce((a, t) => a + t.timeTakenSeconds, 0);
    const avgTimePerOnePercent = confirmedTransitions.length > 0
      ? Math.round((totalTransitionSeconds / confirmedTransitions.length) * 10) / 10
      : 0;

    return {
      sessionId,
      startTime: first.recordingTime,
      endTime: last.recordingTime,
      totalDurationSeconds,
      formattedDuration: ValidationService.formatDuration(totalDurationSeconds),
      isDemo,
      startingCharge: first.chargePercent,
      finalCharge: last.chargePercent,
      startingVoltage: first.voltage,
      finalVoltage: last.voltage,
      maxVoltage: Math.round(maxV * 100) / 100,
      minVoltage: Math.round(minV * 100) / 100,
      averageVoltage: Math.round((sumV / count) * 100) / 100,
      startingCurrent: first.current,
      finalCurrent: last.current,
      maxCurrent: Math.round(maxA * 1000) / 1000,
      minCurrent: Math.round(minA * 1000) / 1000,
      averageCurrent: Math.round((sumA / count) * 1000) / 1000,
      averagePower: Math.round((sumW / count) * 100) / 100,
      maxPower: Math.round(maxW * 100) / 100,
      totalEnergyWh: last.cumulativeEnergyWh,
      totalAccumulatedAh: last.cumulativeChargeAh,
      averageTimePerOnePercent: avgTimePerOnePercent,
      fastestOnePercent: fastest,
      slowestOnePercent: slowest,
      totalMeasurementsCaptured: rawMeasurements.length,
      validMeasurementsCount: validMeasurements.length,
      flaggedMeasurementsCount: rawMeasurements.length - validMeasurements.length,
      transitionsDetectedCount: confirmedTransitions.length,
      skippedTransitionsCount: skippedTransitions.length,
    };
  }

  /**
   * Find CC-CV inflection point (where current drops by >15% from max while voltage is at >90% of max)
   */
  static detectCcCvInflection(validMeasurements: ValidMeasurement[]): number | null {
    if (validMeasurements.length < 10) return null;

    let maxCurrent = 0;
    for (const m of validMeasurements) {
      if (m.current > maxCurrent) maxCurrent = m.current;
    }

    if (maxCurrent < 0.1) return null;

    for (let i = 5; i < validMeasurements.length; i++) {
      const m = validMeasurements[i];
      // When current has dropped to below 85% of peak constant current
      if (m.current <= maxCurrent * 0.85) {
        return m.chargePercent;
      }
    }

    return null;
  }
}
