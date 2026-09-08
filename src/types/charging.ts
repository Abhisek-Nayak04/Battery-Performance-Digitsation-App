/**
 * Battery Charging Performance Digitization System - Types & Interfaces
 */

export enum MeasurementStatus {
  VALID = 'VALID',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  SUSPICIOUS_JUMP = 'SUSPICIOUS_JUMP',
  INVALID_RANGE = 'INVALID_RANGE',
  DISPLAY_NOT_DETECTED = 'DISPLAY_NOT_DETECTED',
  UNPARSED = 'UNPARSED',
  MISSING_DATA = 'MISSING_DATA'
}

export enum TransitionStatus {
  CONFIRMED = 'CONFIRMED',
  PERCENTAGE_TRANSITION_SKIPPED = 'PERCENTAGE_TRANSITION_SKIPPED',
  INCOMPLETE = 'INCOMPLETE'
}

export enum SystemMode {
  REAL_CAMERA = 'REAL_CAMERA',
  REAL_VIDEO_FILE = 'REAL_VIDEO_FILE',
  DEMO_SIMULATION = 'DEMO_SIMULATION'
}

export interface RegionOfInterest {
  x: number;      // 0 to 1 normalized
  y: number;      // 0 to 1 normalized
  width: number;  // 0 to 1 normalized
  height: number; // 0 to 1 normalized
}

export interface DisplayZoneConfig {
  useZones: boolean;
  voltageZone: RegionOfInterest;
  currentZone: RegionOfInterest;
  chargeZone: RegionOfInterest;
}

export interface ValidationConfig {
  minVoltage: number;       // default 0.0
  maxVoltage: number;       // default 300.0
  minCurrent: number;       // default 0.0
  maxCurrent: number;       // default 50.0
  allowNegativeCurrent: boolean; // default false
  minConfidence: number;    // default 80%
  maxVoltageJump: number;   // default 15.0 V/s
  maxCurrentJump: number;   // default 10.0 A/s
  maxChargeJump: number;    // default 3.0 %/s
  samplingIntervalMs: number; // default 1000 ms
}

export interface ImagePreprocessingConfig {
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  threshold: number;   // 0 to 255 (0 = auto Otsu)
  invert: boolean;
  sharpen: boolean;
  denoise: boolean;
}

export interface RawMeasurement {
  id: number;
  sessionId: string;
  timestamp: number;         // epoch ms
  recordingTime: string;     // HH:mm:ss
  elapsedTime: string;       // HH:mm:ss
  elapsedSeconds: number;
  isDemo: boolean;
  
  // OCR raw output
  rawOcrText: string;
  voltageConfidence: number;
  currentConfidence: number;
  chargeConfidence: number;
  overallConfidence: number;
  
  // Parsed candidates
  parsedVoltage: number | null;
  parsedCurrent: number | null;
  parsedCharge: number | null;
  
  // Status & validation
  status: MeasurementStatus;
  statusReason?: string;
  
  // Validated values (null if not valid)
  voltage: number | null;
  current: number | null;
  chargePercent: number | null;
}

export interface ValidMeasurement {
  id: number;
  sessionId: string;
  timestamp: number;
  recordingTime: string;
  elapsedTime: string;
  elapsedSeconds: number;
  isDemo: boolean;
  
  // Electrical measurements
  voltage: number;         // V
  current: number;         // A
  chargePercent: number;   // %
  
  // Calculated electrical parameters
  power: number;           // W (V * A)
  intervalSeconds: number; // dt from previous valid measurement
  intervalEnergyWh: number;// Wh (trapezoidal integration)
  cumulativeEnergyWh: number;
  intervalChargeAh: number;// Ah (trapezoidal integration)
  cumulativeChargeAh: number;
  
  confidence: number;
}

export interface PercentageTransition {
  fromCharge: number;
  toCharge: number;
  startTime: string;
  endTime: string;
  startTimestamp: number;
  endTimestamp: number;
  timeTakenSeconds: number;
  formattedDuration: string;
  
  // Electrical statistics during this 1% window
  averageVoltage: number;
  minVoltage: number;
  maxVoltage: number;
  averageCurrent: number;
  minCurrent: number;
  maxCurrent: number;
  averagePower: number;
  maxPower: number;
  energyUsedWh: number;
  chargeAccumulatedAh: number;
  
  readingCount: number;
  status: TransitionStatus;
  notes?: string;
}

export interface ChargeRangeSummary {
  rangeLabel: string; // "0–10%", "10–20%", etc.
  fromCharge: number;
  toCharge: number;
  totalTimeSeconds: number;
  formattedTime: string;
  averageVoltage: number;
  averageCurrent: number;
  averagePower: number;
  energyConsumedWh: number;
  chargeAccumulatedAh: number;
  averageTimePerOnePercent: number;
  status: 'COMPLETE' | 'PARTIAL' | 'PENDING';
}

export interface SessionSummary {
  sessionId: string;
  startTime: string;
  endTime: string;
  totalDurationSeconds: number;
  formattedDuration: string;
  isDemo: boolean;
  
  startingCharge: number | null;
  finalCharge: number | null;
  
  startingVoltage: number | null;
  finalVoltage: number | null;
  maxVoltage: number | null;
  minVoltage: number | null;
  averageVoltage: number | null;
  
  startingCurrent: number | null;
  finalCurrent: number | null;
  maxCurrent: number | null;
  minCurrent: number | null;
  averageCurrent: number | null;
  
  averagePower: number | null;
  maxPower: number | null;
  totalEnergyWh: number;
  totalAccumulatedAh: number;
  
  averageTimePerOnePercent: number;
  fastestOnePercent: {
    from: number;
    to: number;
    timeSeconds: number;
  } | null;
  slowestOnePercent: {
    from: number;
    to: number;
    timeSeconds: number;
  } | null;
  
  totalMeasurementsCaptured: number;
  validMeasurementsCount: number;
  flaggedMeasurementsCount: number;
  transitionsDetectedCount: number;
  skippedTransitionsCount: number;
}

export interface BatteryReviewInsights {
  fastestInterval: PercentageTransition | null;
  slowestInterval: PercentageTransition | null;
  constantCurrentToConstantVoltageInflectionPercent: number | null;
  voltageDelta: number;
  currentDropPercent: number;
}
