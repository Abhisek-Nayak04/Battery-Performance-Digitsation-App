/**
 * Battery Charging Performance Digitization System
 * Camera-based display digitization, OCR extraction, physical validation,
 * electrical calculations, 1% transition tracking, live engineering graphs, and multi-sheet Excel export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  LineChart,
  Table,
  Layers,
  Database,
  FileSpreadsheet,
  Cpu,
  Camera,
  Video,
} from 'lucide-react';
import {
  DisplayZoneConfig,
  ImagePreprocessingConfig,
  MeasurementStatus,
  PercentageTransition,
  RawMeasurement,
  RegionOfInterest,
  SessionSummary,
  SystemMode,
  ValidationConfig,
  ValidMeasurement,
} from './types/charging';
import { ImageProcessingService, FrameQualityAnalysis } from './services/imageProcessing';
import { OcrEngineService } from './services/ocrEngine';
import { ValidationService } from './services/validationService';
import { CalculationEngine } from './services/calculationEngine';
import { ExcelExportService } from './services/excelExport';

// Components
import { CameraFeed } from './components/CameraFeed';
import { ImagePipelinePreview } from './components/ImagePipelinePreview';
import { LiveTelemetryCard, LiveOpticalReading } from './components/LiveTelemetryCard';
import { GraphsView } from './components/GraphsView';
import { OnePercentTable } from './components/OnePercentTable';
import { RangeAnalysisTable } from './components/RangeAnalysisTable';
import { RawDataTable } from './components/RawDataTable';
import { SummaryCard } from './components/SummaryCard';
import { SessionControlBar } from './components/SessionControlBar';
import { TestSuiteModal } from './components/TestSuiteModal';

export default function App() {
  // ----------------------------------------------------
  // System State & Configuration
  // ----------------------------------------------------
  const [sessionId, setSessionId] = useState<string>(() => `SESSION-${Date.now().toString().slice(-6)}`);
  const [sessionStartTs, setSessionStartTs] = useState<number>(Date.now());
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<SystemMode>(SystemMode.REAL_CAMERA); // Pure Real Hardware Camera by default

  const [activeNavTab, setActiveNavTab] = useState<'live' | 'graphs' | '1percent' | 'ranges' | 'raw' | 'summary'>('live');
  const [showTestSuite, setShowTestSuite] = useState(false);

  // Region of Interest (ROI)
  const [roi, setRoi] = useState<RegionOfInterest>({
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  });

  // Display Zones
  const [zoneConfig, setZoneConfig] = useState<DisplayZoneConfig>({
    useZones: false,
    voltageZone: { x: 0.05, y: 0.15, width: 0.9, height: 0.25 },
    currentZone: { x: 0.05, y: 0.45, width: 0.9, height: 0.25 },
    chargeZone: { x: 0.05, y: 0.75, width: 0.9, height: 0.22 },
  });

  // Computer Vision Preprocessing config
  const [preprocessingConfig, setPreprocessingConfig] = useState<ImagePreprocessingConfig>({
    brightness: 0,
    contrast: 30,
    threshold: 0, // 0 = Auto Otsu
    invert: false,
    sharpen: true,
    denoise: false,
  });

  // Physical Limits & Validation config
  const [validationConfig, setValidationConfig] = useState<ValidationConfig>({
    minVoltage: 0.0,
    maxVoltage: 300.0,
    minCurrent: 0.0,
    maxCurrent: 50.0,
    allowNegativeCurrent: false,
    minConfidence: 75,
    maxVoltageJump: 15.0,
    maxCurrentJump: 10.0,
    maxChargeJump: 3.0,
    samplingIntervalMs: 1000,
  });

  // ----------------------------------------------------
  // Session Measurement Collections
  // ----------------------------------------------------
  const [rawMeasurements, setRawMeasurements] = useState<RawMeasurement[]>([]);
  const [validMeasurements, setValidMeasurements] = useState<ValidMeasurement[]>([]);
  const [transitions, setTransitions] = useState<PercentageTransition[]>([]);
  const [lastRawOcrText, setLastRawOcrText] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<MeasurementStatus>(MeasurementStatus.UNPARSED);
  const [liveOpticalReading, setLiveOpticalReading] = useState<LiveOpticalReading | null>(null);

  // References for live rendering & CV pipeline
  const preprocessedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const measurementCounterRef = useRef<number>(1);
  const isProcessingFrameRef = useRef<boolean>(false);

  // ----------------------------------------------------
  // Initialize Tesseract OCR Worker on Mount
  // ----------------------------------------------------
  useEffect(() => {
    OcrEngineService.initWorker();
    return () => {
      OcrEngineService.terminateWorker();
    };
  }, []);

  // ----------------------------------------------------
  // Derived Session Summaries
  // ----------------------------------------------------
  const rangeSummaries = React.useMemo(() => {
    return CalculationEngine.computeChargeRangeSummaries(validMeasurements);
  }, [validMeasurements]);

  const sessionSummary: SessionSummary = React.useMemo(() => {
    return CalculationEngine.generateSessionSummary(
      sessionId,
      rawMeasurements,
      validMeasurements,
      transitions,
      false // Real test data, not demo
    );
  }, [sessionId, rawMeasurements, validMeasurements, transitions]);

  const latestValid = validMeasurements.length > 0 ? validMeasurements[validMeasurements.length - 1] : null;
  const latestRaw = rawMeasurements.length > 0 ? rawMeasurements[rawMeasurements.length - 1] : null;

  // ----------------------------------------------------
  // Core Real Image & OCR Frame Pipeline Handler
  // ----------------------------------------------------
  const handleFrameCaptured = useCallback(async (
    displayCanvas: HTMLCanvasElement,
    quality: FrameQualityAnalysis
  ) => {
    if (isProcessingFrameRef.current) return;
    isProcessingFrameRef.current = true;

    try {
      // 1. Prepare target preprocessed canvas
      if (!preprocessedCanvasRef.current) {
        preprocessedCanvasRef.current = document.createElement('canvas');
      }
      ImageProcessingService.preprocessImage(
        displayCanvas,
        preprocessedCanvasRef.current,
        preprocessingConfig
      );

      // 2. Check if display was detected
      if (!quality.displayDetected) {
        setCurrentStatus(MeasurementStatus.DISPLAY_NOT_DETECTED);
        if (isSessionActive && !isPaused) {
          const timestamp = Date.now();
          const elapsedSec = Math.floor((timestamp - sessionStartTs) / 1000);
          const rawItem: RawMeasurement = {
            id: measurementCounterRef.current++,
            sessionId,
            timestamp,
            recordingTime: new Date(timestamp).toTimeString().split(' ')[0],
            elapsedTime: ValidationService.formatDuration(elapsedSec),
            elapsedSeconds: elapsedSec,
            isDemo: false,
            rawOcrText: 'DISPLAY_NOT_DETECTED',
            voltageConfidence: 0,
            currentConfidence: 0,
            chargeConfidence: 0,
            overallConfidence: 0,
            parsedVoltage: null,
            parsedCurrent: null,
            parsedCharge: null,
            status: MeasurementStatus.DISPLAY_NOT_DETECTED,
            statusReason: 'Charger display region not detected in frame or lighting too poor',
            voltage: null,
            current: null,
            chargePercent: null,
          };
          setRawMeasurements(prev => [...prev, rawItem]);
        }
        return;
      }

      // 3. Real OCR Recognition on Preprocessed Frame
      const ocrResult = await OcrEngineService.recognizeCanvas(preprocessedCanvasRef.current, zoneConfig);
      setLastRawOcrText(ocrResult.rawText);

      setLiveOpticalReading({
        voltage: ocrResult.voltage,
        current: ocrResult.current,
        chargePercent: ocrResult.chargePercent,
        voltageConfidence: ocrResult.voltageConfidence,
        currentConfidence: ocrResult.currentConfidence,
        chargeConfidence: ocrResult.chargeConfidence,
        overallConfidence: ocrResult.overallConfidence,
        status: (ocrResult.voltage !== null || ocrResult.current !== null || ocrResult.chargePercent !== null) ? MeasurementStatus.VALID : MeasurementStatus.UNPARSED,
        statusReason: `OCR Extracted via ${ocrResult.method}`,
        rawText: ocrResult.rawText,
      });

      if (!isSessionActive) {
        if (ocrResult.voltage !== null || ocrResult.current !== null || ocrResult.chargePercent !== null) {
          setCurrentStatus(MeasurementStatus.VALID);
        }
      }

      // If test session is active and not paused, validate and record measurement
      if (isSessionActive && !isPaused) {
        const timestamp = Date.now();
        const prevValid = validMeasurements.length > 0 ? validMeasurements[validMeasurements.length - 1] : null;

        // 4. Validate Reading
        const rawMeasurement = ValidationService.validateReading(
          measurementCounterRef.current++,
          sessionId,
          timestamp,
          sessionStartTs,
          ocrResult,
          validationConfig,
          prevValid,
          false // Real test data
        );

        setCurrentStatus(rawMeasurement.status);
        setRawMeasurements(prev => [...prev, rawMeasurement]);

        // 5. Calculate Electrical Parameters if VALID
        if (rawMeasurement.status === MeasurementStatus.VALID) {
          const newValid = CalculationEngine.processValidMeasurement(rawMeasurement, prevValid);
          const updatedValidList = [...validMeasurements, newValid];
          setValidMeasurements(updatedValidList);

          // 6. Detect Charge Percentage Transitions
          const updatedTransitions = CalculationEngine.computePercentageTransitions(updatedValidList);
          setTransitions(updatedTransitions);
        }
      }
    } catch (err) {
      console.error('Real OCR frame processing error:', err);
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [
    preprocessingConfig,
    zoneConfig,
    isSessionActive,
    isPaused,
    sessionStartTs,
    sessionId,
    validMeasurements,
    validationConfig,
  ]);

  // ----------------------------------------------------
  // Session Controls
  // ----------------------------------------------------
  const handleStartSession = () => {
    const newSessionId = `SESSION-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(newSessionId);
    setSessionStartTs(Date.now());
    setIsSessionActive(true);
    setIsPaused(false);
    measurementCounterRef.current = 1;
    setRawMeasurements([]);
    setValidMeasurements([]);
    setTransitions([]);
  };

  const handlePauseSession = () => setIsPaused(true);
  const handleResumeSession = () => setIsPaused(false);

  const handleStopSession = () => {
    setIsSessionActive(false);
    setIsPaused(false);
  };

  const handleResetSession = () => {
    setIsSessionActive(false);
    setIsPaused(false);
    setRawMeasurements([]);
    setValidMeasurements([]);
    setTransitions([]);
    measurementCounterRef.current = 1;
  };

  // Export 6-Sheet XLSX Workbook
  const handleExportExcel = () => {
    ExcelExportService.exportFullSession(
      sessionId,
      rawMeasurements,
      validMeasurements,
      transitions,
      rangeSummaries,
      sessionSummary
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Engineering Banner */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
                BATTERY CHARGING DIGITIZATION SYSTEM
              </h1>
              <p className="text-[11px] text-slate-400">
                Automated Optical Telemetry OCR, 1% Transition Engine, and Multi-Sheet Spreadsheet Exporter
              </p>
            </div>
          </div>

          {/* Active Hardware Indicator & Verification Suite Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {mode === SystemMode.REAL_CAMERA ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" /> LIVE CAMERA FEED
                </span>
              ) : (
                <span className="text-sky-300 font-bold flex items-center gap-1">
                  <Video className="w-3.5 h-3.5" /> REAL VIDEO SOURCE
                </span>
              )}
            </div>

            <button
              onClick={() => setShowTestSuite(true)}
              className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              Verify System (18 Tests)
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 flex flex-col gap-4 flex-1">
        {/* 1. Session Control Bar */}
        <SessionControlBar
          sessionId={sessionId}
          isSessionActive={isSessionActive}
          isPaused={isPaused}
          mode={mode}
          onModeChange={setMode}
          onStartSession={handleStartSession}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
          onStopSession={handleStopSession}
          onResetSession={handleResetSession}
          samplingIntervalMs={validationConfig.samplingIntervalMs}
          onSamplingIntervalChange={ms => setValidationConfig({ ...validationConfig, samplingIntervalMs: ms })}
          validationConfig={validationConfig}
          onValidationConfigChange={setValidationConfig}
          onOpenTestSuite={() => setShowTestSuite(true)}
          onExportExcel={handleExportExcel}
          validCount={validMeasurements.length}
          frameCount={rawMeasurements.length}
        />

        {/* 2. Navigation Tab Bar */}
        <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveNavTab('live')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === 'live'
                ? 'border-sky-500 bg-slate-900 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" /> Live Camera &amp; Telemetry
          </button>

          <button
            onClick={() => setActiveNavTab('graphs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === 'graphs'
                ? 'border-indigo-500 bg-slate-900 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="w-4 h-4" /> 10 Engineering Graphs
          </button>

          <button
            onClick={() => setActiveNavTab('1percent')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === '1percent'
                ? 'border-amber-500 bg-slate-900 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-4 h-4" /> 1% Transition Dataset ({transitions.length})
          </button>

          <button
            onClick={() => setActiveNavTab('ranges')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === 'ranges'
                ? 'border-emerald-500 bg-slate-900 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" /> 10% Range Breakdown
          </button>

          <button
            onClick={() => setActiveNavTab('summary')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === 'summary'
                ? 'border-cyan-500 bg-slate-900 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Session Summary &amp; Review
          </button>

          <button
            onClick={() => setActiveNavTab('raw')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              activeNavTab === 'raw'
                ? 'border-purple-500 bg-slate-900 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> Raw OCR Audit ({rawMeasurements.length})
          </button>
        </div>

        {/* Tab 1: Live Camera, Preprocessing & Telemetry */}
        {activeNavTab === 'live' && (
          <div className="flex flex-col gap-4">
            <LiveTelemetryCard
              currentMeasurement={latestValid}
              lastRawMeasurement={latestRaw}
              liveReading={liveOpticalReading}
              status={currentStatus}
              isSessionActive={isSessionActive}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CameraFeed
                mode={mode}
                onModeChange={setMode}
                roi={roi}
                onRoiChange={setRoi}
                zoneConfig={zoneConfig}
                onZoneConfigChange={setZoneConfig}
                onFrameCaptured={handleFrameCaptured}
                isCapturing={true}
                samplingIntervalMs={validationConfig.samplingIntervalMs}
              />

              <ImagePipelinePreview
                sourceDisplayCanvas={preprocessedCanvasRef.current}
                config={preprocessingConfig}
                onConfigChange={setPreprocessingConfig}
                rawOcrText={lastRawOcrText}
              />
            </div>
          </div>
        )}

        {/* Tab 2: 10 Engineering Graphs */}
        {activeNavTab === 'graphs' && (
          <GraphsView
            validMeasurements={validMeasurements}
            transitions={transitions}
          />
        )}

        {/* Tab 3: 1% Transitions Table */}
        {activeNavTab === '1percent' && (
          <OnePercentTable transitions={transitions} />
        )}

        {/* Tab 4: 10% Range Analysis */}
        {activeNavTab === 'ranges' && (
          <RangeAnalysisTable rangeSummaries={rangeSummaries} />
        )}

        {/* Tab 5: Session Summary & Performance Review */}
        {activeNavTab === 'summary' && (
          <SummaryCard
            summary={sessionSummary}
            transitions={transitions}
            validMeasurements={validMeasurements}
            onExportExcel={handleExportExcel}
          />
        )}

        {/* Tab 6: Raw OCR Audit Trail */}
        {activeNavTab === 'raw' && (
          <RawDataTable rawMeasurements={rawMeasurements} />
        )}
      </main>

      {/* Automated Verification Suite Modal (Tests 1 - 18) */}
      <TestSuiteModal
        isOpen={showTestSuite}
        onClose={() => setShowTestSuite(false)}
      />
    </div>
  );
}
