/**
 * OCR & Number Recognition Service
 * Extracts Voltage (V), Current (A), and Charge (%) with decimal support and confidence calculation.
 */

import { createWorker, Worker } from 'tesseract.js';
import { DisplayZoneConfig, RegionOfInterest } from '../types/charging';
import { ImageProcessingService } from './imageProcessing';

export interface OcrExtractionResult {
  rawText: string;
  voltage: number | null;
  current: number | null;
  chargePercent: number | null;
  voltageConfidence: number;
  currentConfidence: number;
  chargeConfidence: number;
  overallConfidence: number;
  method: 'unit_labels' | 'zone_mapping' | 'heuristic_position';
}

export class OcrEngineService {
  private static tesseractWorker: Worker | null = null;
  private static isInitializing = false;
  private static workerReady = false;
  private static initPromise: Promise<boolean> | null = null;

  /**
   * Lazily initialize Tesseract worker
   */
  static async initWorker(): Promise<boolean> {
    if (this.workerReady && this.tesseractWorker) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.isInitializing = true;
        const worker = await createWorker('eng');

        // Configure PSM for sparse multimeter / charger LCD layout
        await worker.setParameters({
          tessedit_pageseg_mode: '11' as any, // Sparse text layout
        });

        this.tesseractWorker = worker;
        this.workerReady = true;
        this.isInitializing = false;
        return true;
      } catch (err) {
        console.warn('Tesseract worker initialization notice:', err);
        this.isInitializing = false;
        this.workerReady = false;
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Recognize text and parse electrical values from a preprocessed canvas
   */
  static async recognizeCanvas(
    displayCanvas: HTMLCanvasElement,
    zoneConfig?: DisplayZoneConfig
  ): Promise<OcrExtractionResult> {
    // Ensure worker is ready
    if (!this.workerReady || !this.tesseractWorker) {
      await this.initWorker();
    }

    // If zone mapping is enabled, crop and recognize each zone individually
    if (zoneConfig && zoneConfig.useZones) {
      return this.recognizeWithZones(displayCanvas, zoneConfig);
    }

    // Otherwise recognize full display and parse by unit labels & heuristics
    return this.recognizeFullDisplay(displayCanvas);
  }

  /**
   * Recognize full display and parse values by unit labels (V, A, %)
   */
  private static async recognizeFullDisplay(canvas: HTMLCanvasElement): Promise<OcrExtractionResult> {
    let recognizedText = '';
    let lineConfidence = 85;

    // Use Tesseract if ready
    if (this.workerReady && this.tesseractWorker) {
      try {
        const ret = await this.tesseractWorker.recognize(canvas);
        recognizedText = ret.data.text || '';
        lineConfidence = Math.max(70, Math.round(ret.data.confidence || 85));
      } catch (err) {
        console.warn('Tesseract recognition notice:', err);
      }
    }

    return this.parseTextByUnits(recognizedText, lineConfidence);
  }

  /**
   * Recognize display using 3 fixed sub-regions (Voltage, Current, Charge %)
   */
  private static async recognizeWithZones(
    canvas: HTMLCanvasElement,
    zoneConfig: DisplayZoneConfig
  ): Promise<OcrExtractionResult> {
    const vCanvas = document.createElement('canvas');
    const aCanvas = document.createElement('canvas');
    const pCanvas = document.createElement('canvas');

    ImageProcessingService.extractRoi(canvas, zoneConfig.voltageZone, vCanvas);
    ImageProcessingService.extractRoi(canvas, zoneConfig.currentZone, aCanvas);
    ImageProcessingService.extractRoi(canvas, zoneConfig.chargeZone, pCanvas);

    let vText = '';
    let aText = '';
    let pText = '';
    let vConf = 0;
    let aConf = 0;
    let pConf = 0;

    if (this.workerReady && this.tesseractWorker) {
      try {
        const [vRes, aRes, pRes] = await Promise.all([
          this.tesseractWorker.recognize(vCanvas),
          this.tesseractWorker.recognize(aCanvas),
          this.tesseractWorker.recognize(pCanvas),
        ]);
        vText = vRes.data.text.trim();
        vConf = Math.max(70, Math.round(vRes.data.confidence || 85));
        aText = aRes.data.text.trim();
        aConf = Math.max(70, Math.round(aRes.data.confidence || 85));
        pText = pRes.data.text.trim();
        pConf = Math.max(70, Math.round(pRes.data.confidence || 85));
      } catch (e) {
        console.warn('Zone OCR notice:', e);
      }
    }

    const voltage = this.extractNumericValue(vText);
    const current = this.extractNumericValue(aText);
    const charge = this.extractNumericValue(pText);

    const overall = Math.round((vConf + aConf + pConf) / 3);

    return {
      rawText: `V_ZONE: "${vText}" | A_ZONE: "${aText}" | %_ZONE: "${pText}"`,
      voltage,
      current,
      chargePercent: charge !== null ? Math.round(charge) : null,
      voltageConfidence: voltage !== null ? vConf : 0,
      currentConfidence: current !== null ? aConf : 0,
      chargeConfidence: charge !== null ? pConf : 0,
      overallConfidence: overall,
      method: 'zone_mapping',
    };
  }

  /**
   * Extract single number from a text string with OCR error repairs
   */
  static extractNumericValue(text: string): number | null {
    if (!text) return null;
    const cleaned = text
      .replace(/[oO]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/,/g, '.');
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }

  /**
   * Robust multi-pass text parser for charger & multimeter optical feeds
   */
  static parseTextByUnits(rawText: string, baseConfidence = 85): OcrExtractionResult {
    let voltage: number | null = null;
    let current: number | null = null;
    let chargePercent: number | null = null;

    let vConf = 0;
    let aConf = 0;
    let pConf = 0;

    const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

    // Pass 1: Line-by-line inspection with prefixes and suffixes
    for (const line of lines) {
      // Normalize common OCR character confusions in numbers
      const normLine = line
        .replace(/(?<=\d)[oO](?=\d)/g, '0')
        .replace(/(?<=\d)[lI](?=\d)/g, '1')
        .replace(/,/g, '.');

      // Check for Voltage (prefixed or suffixed)
      if (voltage === null) {
        const vPrefMatch = normLine.match(/(?:VOLT|VOLTAGE|VOLTS|VDC|Vout|\bV\b|V(?=\d))[\s:=-]*(\d+(?:\.\d+)?)/i);
        if (vPrefMatch) {
          voltage = parseFloat(vPrefMatch[1]);
          vConf = baseConfidence;
        } else {
          const vSuffMatch = normLine.match(/(\d+(?:\.\d+)?)\s*(?:V|VOLT|VOLTS|VDC)(?![A-Za-z])/i);
          if (vSuffMatch) {
            voltage = parseFloat(vSuffMatch[1]);
            vConf = baseConfidence;
          }
        }
      }

      // Check for Current (prefixed or suffixed)
      if (current === null) {
        const aPrefMatch = normLine.match(/(?:CURRENT|CURR|AMPS?|AMPERE|Iout|\bA\b|A(?=\d)|\bI\b)[\s:=-]*(\d+(?:\.\d+)?)/i);
        if (aPrefMatch) {
          current = parseFloat(aPrefMatch[1]);
          aConf = baseConfidence;
        } else {
          const aSuffMatch = normLine.match(/(\d+(?:\.\d+)?)\s*(?:A|AMP|AMPS)(?![A-Za-z])/i);
          if (aSuffMatch) {
            current = parseFloat(aSuffMatch[1]);
            aConf = baseConfidence;
          }
        }
      }

      // Check for Charge % (prefixed or suffixed)
      if (chargePercent === null) {
        const pPrefMatch = normLine.match(/(?:SOC|CHG|CHARGE|BATT?|BATTERY|%|PCT)[\s:=-]*(\d+(?:\.\d+)?)/i);
        if (pPrefMatch) {
          chargePercent = Math.round(parseFloat(pPrefMatch[1]));
          pConf = baseConfidence;
        } else {
          const pSuffMatch = normLine.match(/(\d+(?:\.\d+)?)\s*%/i);
          if (pSuffMatch) {
            chargePercent = Math.round(parseFloat(pSuffMatch[1]));
            pConf = baseConfidence;
          }
        }
      }
    }

    // Pass 2: Global regex match on full text for inline values
    if (voltage === null) {
      const vm = rawText.match(/(\d+(?:\.\d+)?)\s*(?:V|VOLT|VOLTS|VDC)(?![A-Za-z])/i);
      if (vm) {
        voltage = parseFloat(vm[1]);
        vConf = Math.round(baseConfidence * 0.95);
      }
    }
    if (current === null) {
      const am = rawText.match(/(\d+(?:\.\d+)?)\s*(?:A|AMP|AMPS)(?![A-Za-z])/i);
      if (am) {
        current = parseFloat(am[1]);
        aConf = Math.round(baseConfidence * 0.95);
      }
    }
    if (chargePercent === null) {
      const pm = rawText.match(/(\d+(?:\.\d+)?)\s*%/);
      if (pm) {
        chargePercent = Math.round(parseFloat(pm[1]));
        pConf = Math.round(baseConfidence * 0.95);
      }
    }

    // Pass 3: Positional and physical range heuristics for plain unlabeled numbers
    const allNumbers = [...rawText.matchAll(/(\d+(?:\.\d+)?)/g)]
      .map(m => parseFloat(m[1]))
      .filter(n => !isNaN(n));

    const unassigned = allNumbers.filter(
      n => n !== voltage && n !== current && n !== chargePercent
    );

    // If 3 consecutive numbers with standard 3-tier display layout: [Voltage, Current, Charge %]
    if (voltage === null && current === null && chargePercent === null && allNumbers.length >= 3) {
      voltage = allNumbers[0];
      current = allNumbers[1];
      chargePercent = Math.round(allNumbers[2]);
      vConf = Math.round(baseConfidence * 0.85);
      aConf = Math.round(baseConfidence * 0.85);
      pConf = Math.round(baseConfidence * 0.85);
    } else {
      // Assign individual remaining numbers by plausibility
      if (voltage === null && unassigned.length > 0) {
        const vCandidate = unassigned.find(n => n >= 3.0 && n <= 600.0);
        if (vCandidate !== undefined) {
          voltage = vCandidate;
          vConf = Math.round(baseConfidence * 0.8);
          unassigned.splice(unassigned.indexOf(vCandidate), 1);
        }
      }

      if (current === null && unassigned.length > 0) {
        const aCandidate = unassigned.find(n => n >= 0.0 && n <= 100.0 && n !== voltage);
        if (aCandidate !== undefined) {
          current = aCandidate;
          aConf = Math.round(baseConfidence * 0.8);
          unassigned.splice(unassigned.indexOf(aCandidate), 1);
        }
      }

      if (chargePercent === null && unassigned.length > 0) {
        const pCandidate = unassigned.find(n => n >= 0 && n <= 100 && n !== voltage && n !== current);
        if (pCandidate !== undefined) {
          chargePercent = Math.round(pCandidate);
          pConf = Math.round(baseConfidence * 0.8);
        }
      }
    }

    const confidences = [vConf, aConf, pConf].filter(c => c > 0);
    const overallConfidence = confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

    return {
      rawText,
      voltage,
      current,
      chargePercent,
      voltageConfidence: vConf,
      currentConfidence: aConf,
      chargeConfidence: pConf,
      overallConfidence,
      method: 'unit_labels',
    };
  }

  /**
   * Clean termination of worker
   */
  static async terminateWorker(): Promise<void> {
    if (this.tesseractWorker) {
      try {
        await this.tesseractWorker.terminate();
      } catch (e) {
        console.error('Error terminating worker:', e);
      }
      this.tesseractWorker = null;
      this.workerReady = false;
    }
  }
}
