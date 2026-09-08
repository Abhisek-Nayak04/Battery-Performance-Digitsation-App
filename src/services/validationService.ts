/**
 * Reading Validation Service
 * Validates numeric ranges, physics consistency, confidence thresholds, and suspicious rate-of-change jumps.
 */

import {
  MeasurementStatus,
  RawMeasurement,
  ValidationConfig,
  ValidMeasurement,
} from '../types/charging';
import { OcrExtractionResult } from './ocrEngine';

export class ValidationService {
  /**
   * Validate an OCR extraction result against physical limits and previous valid measurements
   */
  static validateReading(
    id: number,
    sessionId: string,
    timestamp: number,
    sessionStartTimestamp: number,
    ocrResult: OcrExtractionResult,
    config: ValidationConfig,
    previousValid: ValidMeasurement | null,
    isDemo: boolean = false
  ): RawMeasurement {
    const elapsedSeconds = Math.max(0, Math.floor((timestamp - sessionStartTimestamp) / 1000));
    const recordingTime = new Date(timestamp).toTimeString().split(' ')[0];
    const elapsedTime = this.formatDuration(elapsedSeconds);

    const {
      voltage,
      current,
      chargePercent,
      voltageConfidence,
      currentConfidence,
      chargeConfidence,
      overallConfidence,
      rawText,
    } = ocrResult;

    // If neither voltage nor current could be recognized, mark UNPARSED
    if (voltage === null && current === null) {
      return {
        id,
        sessionId,
        timestamp,
        recordingTime,
        elapsedTime,
        elapsedSeconds,
        isDemo,
        rawOcrText: rawText,
        voltageConfidence,
        currentConfidence,
        chargeConfidence,
        overallConfidence,
        parsedVoltage: voltage,
        parsedCurrent: current,
        parsedCharge: chargePercent,
        status: MeasurementStatus.UNPARSED,
        statusReason: 'No electrical numbers detected in frame ROI',
        voltage: null,
        current: null,
        chargePercent: null,
      };
    }

    // If one parameter is missing, use intelligent fallback or previous valid state
    let effectiveVoltage = voltage;
    let effectiveCurrent = current;
    let effectiveCharge = chargePercent;

    if (effectiveVoltage === null && previousValid) {
      effectiveVoltage = previousValid.voltage;
    }
    if (effectiveCurrent === null && previousValid) {
      effectiveCurrent = previousValid.current;
    }
    if (effectiveCharge === null) {
      if (previousValid) {
        effectiveCharge = previousValid.chargePercent;
      } else if (effectiveVoltage !== null) {
        // Approximate 0-100% based on configured range
        const vSpan = config.maxVoltage - config.minVoltage;
        effectiveCharge = vSpan > 0
          ? Math.max(0, Math.min(100, Math.round(((effectiveVoltage - config.minVoltage) / vSpan) * 100)))
          : 0;
      } else {
        effectiveCharge = 0;
      }
    }

    if (effectiveVoltage === null || effectiveCurrent === null) {
      return {
        id,
        sessionId,
        timestamp,
        recordingTime,
        elapsedTime,
        elapsedSeconds,
        isDemo,
        rawOcrText: rawText,
        voltageConfidence,
        currentConfidence,
        chargeConfidence,
        overallConfidence,
        parsedVoltage: voltage,
        parsedCurrent: current,
        parsedCharge: chargePercent,
        status: MeasurementStatus.UNPARSED,
        statusReason: `Awaiting: ${voltage === null ? 'Voltage' : 'Current'}`,
        voltage: null,
        current: null,
        chargePercent: null,
      };
    }

    // Check 1: Low Confidence
    const effectiveMinConfidence = Math.min(60, config.minConfidence);
    if (
      (voltageConfidence > 0 && voltageConfidence < effectiveMinConfidence) ||
      (currentConfidence > 0 && currentConfidence < effectiveMinConfidence)
    ) {
      return {
        id,
        sessionId,
        timestamp,
        recordingTime,
        elapsedTime,
        elapsedSeconds,
        isDemo,
        rawOcrText: rawText,
        voltageConfidence,
        currentConfidence,
        chargeConfidence,
        overallConfidence,
        parsedVoltage: voltage,
        parsedCurrent: current,
        parsedCharge: chargePercent,
        status: MeasurementStatus.NEEDS_REVIEW,
        statusReason: `Low optical confidence (V: ${voltageConfidence}%, A: ${currentConfidence}%, %: ${chargeConfidence}%)`,
        voltage: effectiveVoltage,
        current: effectiveCurrent,
        chargePercent: effectiveCharge,
      };
    }

    // Check 2: Range & Physics Constraints
    // Voltage checks
    if (isNaN(effectiveVoltage) || effectiveVoltage < 0) {
      return this.buildInvalidRange(id, sessionId, timestamp, recordingTime, elapsedTime, elapsedSeconds, isDemo, rawText, ocrResult, 'Negative or NaN Voltage');
    }
    if (effectiveVoltage < config.minVoltage || effectiveVoltage > config.maxVoltage) {
      return this.buildInvalidRange(
        id, sessionId, timestamp, recordingTime, elapsedTime, elapsedSeconds, isDemo, rawText, ocrResult,
        `Voltage ${effectiveVoltage}V out of configured range [${config.minVoltage}V - ${config.maxVoltage}V]`
      );
    }

    // Current checks
    if (isNaN(effectiveCurrent) || (!config.allowNegativeCurrent && effectiveCurrent < 0)) {
      return this.buildInvalidRange(id, sessionId, timestamp, recordingTime, elapsedTime, elapsedSeconds, isDemo, rawText, ocrResult, 'Negative or NaN Current');
    }
    if (effectiveCurrent < config.minCurrent || effectiveCurrent > config.maxCurrent) {
      return this.buildInvalidRange(
        id, sessionId, timestamp, recordingTime, elapsedTime, elapsedSeconds, isDemo, rawText, ocrResult,
        `Current ${effectiveCurrent}A out of configured range [${config.minCurrent}A - ${config.maxCurrent}A]`
      );
    }

    // Charge percentage checks
    if (isNaN(effectiveCharge) || effectiveCharge < 0 || effectiveCharge > 100) {
      return this.buildInvalidRange(
        id, sessionId, timestamp, recordingTime, elapsedTime, elapsedSeconds, isDemo, rawText, ocrResult,
        `Charge ${effectiveCharge}% must be within 0% - 100%`
      );
    }

    // Check 3: Suspicious Jump Detection compared to previous valid measurement
    if (previousValid) {
      const dt = Math.max(1, (timestamp - previousValid.timestamp) / 1000);
      const deltaV = Math.abs(effectiveVoltage - previousValid.voltage);
      const deltaA = Math.abs(effectiveCurrent - previousValid.current);
      const deltaCharge = effectiveCharge - previousValid.chargePercent;

      // Check max rate of change (Jump per second)
      if (deltaV / dt > config.maxVoltageJump) {
        return {
          id,
          sessionId,
          timestamp,
          recordingTime,
          elapsedTime,
          elapsedSeconds,
          isDemo,
          rawOcrText: rawText,
          voltageConfidence,
          currentConfidence,
          chargeConfidence,
          overallConfidence,
          parsedVoltage: voltage,
          parsedCurrent: current,
          parsedCharge: chargePercent,
          status: MeasurementStatus.SUSPICIOUS_JUMP,
          statusReason: `Voltage step jump ${deltaV.toFixed(1)}V in ${dt.toFixed(1)}s exceeds limit of ${config.maxVoltageJump}V/s`,
          voltage: effectiveVoltage,
          current: effectiveCurrent,
          chargePercent: effectiveCharge,
        };
      }

      if (deltaA / dt > config.maxCurrentJump) {
        return {
          id,
          sessionId,
          timestamp,
          recordingTime,
          elapsedTime,
          elapsedSeconds,
          isDemo,
          rawOcrText: rawText,
          voltageConfidence,
          currentConfidence,
          chargeConfidence,
          overallConfidence,
          parsedVoltage: voltage,
          parsedCurrent: current,
          parsedCharge: chargePercent,
          status: MeasurementStatus.SUSPICIOUS_JUMP,
          statusReason: `Current step jump ${deltaA.toFixed(1)}A in ${dt.toFixed(1)}s exceeds limit of ${config.maxCurrentJump}A/s`,
          voltage: effectiveVoltage,
          current: effectiveCurrent,
          chargePercent: effectiveCharge,
        };
      }
    }

    // All validation passed
    return {
      id,
      sessionId,
      timestamp,
      recordingTime,
      elapsedTime,
      elapsedSeconds,
      isDemo,
      rawOcrText: rawText,
      voltageConfidence: voltageConfidence || 85,
      currentConfidence: currentConfidence || 85,
      chargeConfidence: chargeConfidence || 85,
      overallConfidence: overallConfidence || 85,
      parsedVoltage: voltage,
      parsedCurrent: current,
      parsedCharge: chargePercent,
      status: MeasurementStatus.VALID,
      statusReason: 'Validated',
      voltage: effectiveVoltage,
      current: effectiveCurrent,
      chargePercent: effectiveCharge,
    };
  }

  private static buildInvalidRange(
    id: number,
    sessionId: string,
    timestamp: number,
    recordingTime: string,
    elapsedTime: string,
    elapsedSeconds: number,
    isDemo: boolean,
    rawText: string,
    ocrResult: OcrExtractionResult,
    reason: string
  ): RawMeasurement {
    return {
      id,
      sessionId,
      timestamp,
      recordingTime,
      elapsedTime,
      elapsedSeconds,
      isDemo,
      rawOcrText: rawText,
      voltageConfidence: ocrResult.voltageConfidence,
      currentConfidence: ocrResult.currentConfidence,
      chargeConfidence: ocrResult.chargeConfidence,
      overallConfidence: ocrResult.overallConfidence,
      parsedVoltage: ocrResult.voltage,
      parsedCurrent: ocrResult.current,
      parsedCharge: ocrResult.chargePercent,
      status: MeasurementStatus.INVALID_RANGE,
      statusReason: reason,
      voltage: null,
      current: null,
      chargePercent: null,
    };
  }

  public static formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
