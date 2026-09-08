/**
 * Excel Multi-Sheet Workbook Exporter
 * Generates official engineering Excel (.xlsx) files with:
 * - Sheet 1: Raw Data
 * - Sheet 2: Valid Measurements
 * - Sheet 3: 1% Analysis
 * - Sheet 4: Charge Range Analysis
 * - Sheet 5: Summary
 * - Sheet 6: Review / Errors
 */

import * as XLSX from 'xlsx';
import {
  ChargeRangeSummary,
  MeasurementStatus,
  PercentageTransition,
  RawMeasurement,
  SessionSummary,
  ValidMeasurement,
} from '../types/charging';

export class ExcelExportService {
  /**
   * Build and download full multi-sheet XLSX file
   */
  static exportFullSession(
    sessionId: string,
    rawMeasurements: RawMeasurement[],
    validMeasurements: ValidMeasurement[],
    transitions: PercentageTransition[],
    rangeSummaries: ChargeRangeSummary[],
    summary: SessionSummary
  ): void {
    const workbook = XLSX.utils.book_new();

    // ----------------------------------------------------
    // Sheet 1: Raw Data
    // ----------------------------------------------------
    const rawDataRows = rawMeasurements.map(r => ({
      'Measurement ID': r.id,
      'Session ID': r.sessionId,
      'Recording Time': r.recordingTime,
      'Elapsed Time': r.elapsedTime,
      'Elapsed (s)': r.elapsedSeconds,
      'Status': r.status,
      'Status Reason': r.statusReason || '',
      'Raw OCR Text': r.rawOcrText,
      'Overall Conf (%)': r.overallConfidence,
      'Voltage Conf (%)': r.voltageConfidence,
      'Current Conf (%)': r.currentConfidence,
      'Charge Conf (%)': r.chargeConfidence,
      'Parsed Voltage (V)': r.parsedVoltage ?? '',
      'Parsed Current (A)': r.parsedCurrent ?? '',
      'Parsed Charge (%)': r.parsedCharge ?? '',
      'Validated Voltage (V)': r.voltage ?? '',
      'Validated Current (A)': r.current ?? '',
      'Validated Charge (%)': r.chargePercent ?? '',
      'Data Source': 'REAL_OPTICAL_SENSOR',
    }));
    const rawSheet = XLSX.utils.json_to_sheet(rawDataRows.length ? rawDataRows : [{ Note: 'No raw measurements' }]);
    XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Data');

    // ----------------------------------------------------
    // Sheet 2: Valid Measurements
    // ----------------------------------------------------
    const validDataRows = validMeasurements.map(v => ({
      'ID': v.id,
      'Session ID': v.sessionId,
      'Recording Time': v.recordingTime,
      'Elapsed Time': v.elapsedTime,
      'Elapsed (s)': v.elapsedSeconds,
      'Voltage (V)': v.voltage,
      'Current (A)': v.current,
      'Charge (%)': v.chargePercent,
      'Power (W)': v.power,
      'Interval dt (s)': v.intervalSeconds,
      'Interval Energy (Wh)': v.intervalEnergyWh,
      'Cumulative Energy (Wh)': v.cumulativeEnergyWh,
      'Interval Charge (Ah)': v.intervalChargeAh,
      'Cumulative Charge (Ah)': v.cumulativeChargeAh,
      'OCR Confidence (%)': v.confidence,
      'Data Source': 'REAL_OPTICAL_SENSOR',
    }));
    const validSheet = XLSX.utils.json_to_sheet(validDataRows.length ? validDataRows : [{ Note: 'No valid measurements' }]);
    XLSX.utils.book_append_sheet(workbook, validSheet, 'Valid Measurements');

    // ----------------------------------------------------
    // Sheet 3: 1% Analysis
    // ----------------------------------------------------
    const transitionRows = transitions.map(t => ({
      'From (%)': `${t.fromCharge}%`,
      'To (%)': `${t.toCharge}%`,
      'Start Time': t.startTime,
      'End Time': t.endTime,
      'Time Taken (s)': t.timeTakenSeconds,
      'Formatted Duration': t.formattedDuration,
      'Avg Voltage (V)': t.averageVoltage,
      'Min Voltage (V)': t.minVoltage,
      'Max Voltage (V)': t.maxVoltage,
      'Avg Current (A)': t.averageCurrent,
      'Min Current (A)': t.minCurrent,
      'Max Current (A)': t.maxCurrent,
      'Avg Power (W)': t.averagePower,
      'Max Power (W)': t.maxPower,
      'Energy Used (Wh)': t.energyUsedWh,
      'Accumulated Charge (Ah)': t.chargeAccumulatedAh,
      'Reading Count': t.readingCount,
      'Transition Status': t.status,
      'Notes': t.notes || '',
    }));
    const transitionSheet = XLSX.utils.json_to_sheet(transitionRows.length ? transitionRows : [{ Note: 'No transitions detected' }]);
    XLSX.utils.book_append_sheet(workbook, transitionSheet, '1% Analysis');

    // ----------------------------------------------------
    // Sheet 4: Charge Range Analysis
    // ----------------------------------------------------
    const rangeRows = rangeSummaries.map(r => ({
      'Range': r.rangeLabel,
      'From (%)': `${r.fromCharge}%`,
      'To (%)': `${r.toCharge}%`,
      'Total Time (s)': r.totalTimeSeconds,
      'Formatted Time': r.formattedTime,
      'Avg Voltage (V)': r.averageVoltage,
      'Avg Current (A)': r.averageCurrent,
      'Avg Power (W)': r.averagePower,
      'Energy Consumed (Wh)': r.energyConsumedWh,
      'Accumulated Charge (Ah)': r.chargeAccumulatedAh,
      'Avg Time per 1% (s)': r.averageTimePerOnePercent,
      'Status': r.status,
    }));
    const rangeSheet = XLSX.utils.json_to_sheet(rangeRows);
    XLSX.utils.book_append_sheet(workbook, rangeSheet, 'Charge Range Analysis');

    // ----------------------------------------------------
    // Sheet 5: Summary
    // ----------------------------------------------------
    const summaryRows = [
      { 'Metric': 'Session ID', 'Value': summary.sessionId },
      { 'Metric': 'Data Source Mode', 'Value': 'REAL CAMERA / OPTICAL DIGITIZATION' },
      { 'Metric': 'Start Time', 'Value': summary.startTime },
      { 'Metric': 'End Time', 'Value': summary.endTime },
      { 'Metric': 'Total Duration', 'Value': `${summary.formattedDuration} (${summary.totalDurationSeconds}s)` },
      { 'Metric': 'Starting Charge (%)', 'Value': summary.startingCharge !== null ? `${summary.startingCharge}%` : 'N/A' },
      { 'Metric': 'Final Charge (%)', 'Value': summary.finalCharge !== null ? `${summary.finalCharge}%` : 'N/A' },
      { 'Metric': 'Starting Voltage (V)', 'Value': summary.startingVoltage ?? 'N/A' },
      { 'Metric': 'Final Voltage (V)', 'Value': summary.finalVoltage ?? 'N/A' },
      { 'Metric': 'Minimum Voltage (V)', 'Value': summary.minVoltage ?? 'N/A' },
      { 'Metric': 'Maximum Voltage (V)', 'Value': summary.maxVoltage ?? 'N/A' },
      { 'Metric': 'Average Voltage (V)', 'Value': summary.averageVoltage ?? 'N/A' },
      { 'Metric': 'Starting Current (A)', 'Value': summary.startingCurrent ?? 'N/A' },
      { 'Metric': 'Final Current (A)', 'Value': summary.finalCurrent ?? 'N/A' },
      { 'Metric': 'Minimum Current (A)', 'Value': summary.minCurrent ?? 'N/A' },
      { 'Metric': 'Maximum Current (A)', 'Value': summary.maxCurrent ?? 'N/A' },
      { 'Metric': 'Average Current (A)', 'Value': summary.averageCurrent ?? 'N/A' },
      { 'Metric': 'Average Power (W)', 'Value': summary.averagePower ?? 'N/A' },
      { 'Metric': 'Maximum Power (W)', 'Value': summary.maxPower ?? 'N/A' },
      { 'Metric': 'Total Energy Consumed (Wh)', 'Value': summary.totalEnergyWh },
      { 'Metric': 'Total Accumulated Capacity (Ah)', 'Value': summary.totalAccumulatedAh },
      { 'Metric': 'Average Time Per 1% (s)', 'Value': summary.averageTimePerOnePercent },
      {
        'Metric': 'Fastest 1% Interval',
        'Value': summary.fastestOnePercent ? `${summary.fastestOnePercent.from}% -> ${summary.fastestOnePercent.to}% (${summary.fastestOnePercent.timeSeconds}s)` : 'N/A'
      },
      {
        'Metric': 'Slowest 1% Interval',
        'Value': summary.slowestOnePercent ? `${summary.slowestOnePercent.from}% -> ${summary.slowestOnePercent.to}% (${summary.slowestOnePercent.timeSeconds}s)` : 'N/A'
      },
      { 'Metric': 'Total Captured Frames', 'Value': summary.totalMeasurementsCaptured },
      { 'Metric': 'Valid Validated Readings', 'Value': summary.validMeasurementsCount },
      { 'Metric': 'Flagged / Review Frames', 'Value': summary.flaggedMeasurementsCount },
      { 'Metric': 'Confirmed 1% Transitions', 'Value': summary.transitionsDetectedCount },
      { 'Metric': 'Skipped Transitions', 'Value': summary.skippedTransitionsCount },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // ----------------------------------------------------
    // Sheet 6: Review / Errors
    // ----------------------------------------------------
    const errorRows = rawMeasurements
      .filter(r => r.status !== MeasurementStatus.VALID)
      .map(r => ({
        'Measurement ID': r.id,
        'Recording Time': r.recordingTime,
        'Elapsed Time': r.elapsedTime,
        'Flagged Status': r.status,
        'Reason / Diagnosis': r.statusReason || 'Unknown',
        'Raw OCR Text': r.rawOcrText,
        'Overall Conf (%)': r.overallConfidence,
        'V Conf (%)': r.voltageConfidence,
        'A Conf (%)': r.currentConfidence,
        '% Conf (%)': r.chargeConfidence,
        'Parsed V': r.parsedVoltage ?? '',
        'Parsed A': r.parsedCurrent ?? '',
        'Parsed %': r.parsedCharge ?? '',
      }));
    const errorSheet = XLSX.utils.json_to_sheet(errorRows.length ? errorRows : [{ Status: 'NO_ERRORS', Note: 'All captured frames passed validation' }]);
    XLSX.utils.book_append_sheet(workbook, errorSheet, 'Review & Errors');

    // Trigger download
    const filename = `Battery_Charging_${sessionId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }
}
