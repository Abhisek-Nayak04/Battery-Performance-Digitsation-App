/**
 * Demo Mode & Realistic Battery Charging Physics Simulator
 * Simulates a realistic Constant Current / Constant Voltage (CC-CV) battery charging cycle.
 * All records are explicitly flagged with `isDemo: true` and labeled "DEMO DATA".
 */

import { RawMeasurement, ValidationConfig, ValidMeasurement } from '../types/charging';
import { CalculationEngine } from './calculationEngine';
import { OcrExtractionResult } from './ocrEngine';
import { ValidationService } from './validationService';

export class DemoGeneratorService {
  /**
   * Render a synthetic LCD / 7-Segment charger screen onto a canvas
   * This allows testing the computer vision and OCR pipeline against a real visual feed!
   */
  static renderSimulatedDisplay(
    canvas: HTMLCanvasElement,
    voltage: number,
    current: number,
    chargePercent: number
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 320;

    // Dark industrial backlit LCD background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bezel border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Inner display glow
    ctx.fillStyle = '#020617';
    ctx.fillRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Header label
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('DIGITAL SMART BATTERY CHARGER [DEMO FEED]', 26, 38);

    // 1. Voltage Block
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('VOLTAGE', 26, 75);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 44px monospace';
    const vStr = `${voltage.toFixed(1)} V`;
    ctx.fillText(vStr, 26, 125);

    // 2. Current Block
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('CHARGING CURRENT', 26, 170);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 44px monospace';
    const aStr = `${current.toFixed(2)} A`;
    ctx.fillText(aStr, 26, 220);

    // 3. State of Charge Block
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('STATE OF CHARGE', 26, 260);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 40px monospace';
    const pStr = `${Math.round(chargePercent)} %`;
    ctx.fillText(pStr, 26, 298);

    // Graphical battery bar
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(260, 268, 190, 28);
    ctx.fillStyle = chargePercent > 80 ? '#22c55e' : chargePercent > 30 ? '#eab308' : '#ef4444';
    const barW = Math.max(0, (chargePercent / 100) * 184);
    ctx.fillRect(263, 271, barW, 22);
  }

  /**
   * Physics-accurate CC/CV model step
   */
  static getPhysicalStateAtCharge(chargePercent: number) {
    const p = Math.max(0, Math.min(100, chargePercent));
    const noiseV = (Math.random() - 0.5) * 0.04;
    const noiseA = (Math.random() - 0.5) * 0.02;

    let voltage: number;
    let current: number;

    if (p <= 75) {
      // Constant Current (CC) Phase:
      // Voltage smoothly climbs from 11.2V to 14.4V
      voltage = 11.2 + (p / 75) * (14.4 - 11.2) + noiseV;
      // Current is fixed around 2.50A
      current = 2.50 + noiseA;
    } else {
      // Constant Voltage (CV) Phase:
      // Voltage tops out at 14.4V
      voltage = 14.4 + noiseV;
      // Current exponentially tapers down from 2.5A to ~0.25A
      const cvRatio = (p - 75) / 25; // 0 to 1
      current = 2.50 * Math.exp(-2.2 * cvRatio) + noiseA;
      current = Math.max(0.18, current);
    }

    return {
      voltage: Math.round(voltage * 100) / 100,
      current: Math.round(current * 1000) / 1000,
      chargePercent: Math.round(p),
    };
  }

  /**
   * Generates a single simulated frame reading with OCR representation
   */
  static generateDemoStep(
    id: number,
    sessionId: string,
    timestamp: number,
    sessionStartTimestamp: number,
    currentCharge: number,
    config: ValidationConfig,
    previousValid: ValidMeasurement | null,
    injectAnomaly?: 'none' | 'blur' | 'jump' | 'noise'
  ): { raw: RawMeasurement; valid: ValidMeasurement | null } {
    let state = this.getPhysicalStateAtCharge(currentCharge);

    let vConf = 96 + Math.floor(Math.random() * 4);
    let aConf = 95 + Math.floor(Math.random() * 5);
    let pConf = 98 + Math.floor(Math.random() * 2);

    if (injectAnomaly === 'jump') {
      // Intentionally create a 900V jump to test validation
      state.voltage = 928.4;
    } else if (injectAnomaly === 'noise') {
      // Low confidence reading
      vConf = 60;
      aConf = 55;
    }

    const rawText = `${state.voltage.toFixed(1)} V\n${state.current.toFixed(2)} A\n${state.chargePercent} %`;

    const ocrResult: OcrExtractionResult = {
      rawText,
      voltage: state.voltage,
      current: state.current,
      chargePercent: state.chargePercent,
      voltageConfidence: vConf,
      currentConfidence: aConf,
      chargeConfidence: pConf,
      overallConfidence: Math.round((vConf + aConf + pConf) / 3),
      method: 'unit_labels',
    };

    const raw = ValidationService.validateReading(
      id,
      sessionId,
      timestamp,
      sessionStartTimestamp,
      ocrResult,
      config,
      previousValid,
      true // isDemo
    );

    let valid: ValidMeasurement | null = null;
    if (raw.status === 'VALID') {
      valid = CalculationEngine.processValidMeasurement(raw, previousValid);
    }

    return { raw, valid };
  }

  /**
   * Generate an entire full charging test dataset (0% to 100%)
   * Useful for instant verification of all 10 graphs, 1% transition tables, and 6-sheet Excel export!
   */
  static generateCompleteSessionDataset(
    sessionId: string,
    config: ValidationConfig
  ): { rawList: RawMeasurement[]; validList: ValidMeasurement[] } {
    const rawList: RawMeasurement[] = [];
    const validList: ValidMeasurement[] = [];

    const startTimestamp = Date.now() - 3600 * 1000 * 2.5; // 2.5 hours ago
    let currentTs = startTimestamp;
    let measurementId = 1;
    let prevValid: ValidMeasurement | null = null;

    // Simulate 0% to 100% with multiple readings per percentage
    for (let pct = 0; pct <= 100; pct++) {
      // Intentionally demonstrate skipped percentage handling around 42% -> 44% (Section 13)
      if (pct === 43) {
        continue; // Skip 43% to test PERCENTAGE_TRANSITION_SKIPPED!
      }

      // 3 to 6 readings per percentage stage to model duplicate sampling
      const readingsForThisPct = pct > 80 ? 5 : 3;

      for (let r = 0; r < readingsForThisPct; r++) {
        const step = this.generateDemoStep(
          measurementId++,
          sessionId,
          currentTs,
          startTimestamp,
          pct,
          config,
          prevValid,
          'none'
        );

        rawList.push(step.raw);
        if (step.valid) {
          validList.push(step.valid);
          prevValid = step.valid;
        }

        // Advance simulated time: 5 to 15 seconds per reading depending on phase
        const dtSeconds = pct > 80 ? 12 : 6;
        currentTs += dtSeconds * 1000;
      }
    }

    return { rawList, validList };
  }
}
