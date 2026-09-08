/**
 * Camera Feed & Display Region of Interest (ROI) Component
 * Manages live video streaming, connected camera device selection, torch/zoom,
 * recorded video file playback for real digitization, ROI bounding box, and frame quality analysis.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Play,
  Pause,
  Sun,
  Maximize2,
  Video,
  SwitchCamera,
  FastForward,
} from 'lucide-react';
import { DisplayZoneConfig, RegionOfInterest, SystemMode } from '../types/charging';
import { ImageProcessingService, FrameQualityAnalysis } from '../services/imageProcessing';

interface CameraFeedProps {
  mode: SystemMode;
  onModeChange?: (mode: SystemMode) => void;
  roi: RegionOfInterest;
  onRoiChange: (roi: RegionOfInterest) => void;
  zoneConfig: DisplayZoneConfig;
  onZoneConfigChange: (cfg: DisplayZoneConfig) => void;
  onFrameCaptured: (displayCanvas: HTMLCanvasElement, quality: FrameQualityAnalysis) => void;
  isCapturing: boolean;
  samplingIntervalMs: number;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  mode,
  onModeChange,
  roi,
  onRoiChange,
  zoneConfig,
  onZoneConfigChange,
  onFrameCaptured,
  isCapturing,
  samplingIntervalMs,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const benchmarkIntervalRef = useRef<number | null>(null);
  const benchmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // File video playback state (for digitizing real recorded video sessions)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isPlayingVideoFile, setIsPlayingVideoFile] = useState(false);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState<number>(1);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const [quality, setQuality] = useState<FrameQualityAnalysis>({
    meanLuminance: 120,
    isPoorLighting: false,
    blurScore: 45,
    isBlurry: false,
    displayDetected: true,
  });

  const [isDraggingRoi, setIsDraggingRoi] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // List connected camera devices
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && videoDevs[0].deviceId && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      }
    } catch (e) {
      console.info('Media devices query notice:', e);
    }
  };

  // Progressive resilient camera stream retriever
  const acquireCameraStream = async (targetDeviceId?: string, targetFacing?: 'environment' | 'user'): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera MediaDevices API is not supported in this browser context');
    }

    const attempts: MediaStreamConstraints[] = [];

    // Attempt 1: Target device ID if non-empty
    if (targetDeviceId && targetDeviceId.trim() !== '') {
      attempts.push({
        video: {
          deviceId: { ideal: targetDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    }

    // Attempt 2: Preferred facing mode with ideal parameter (prevents OverconstrainedError on front-only cams)
    if (targetFacing) {
      attempts.push({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    }

    // Attempt 3: Standard resolution fallback
    attempts.push({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    // Attempt 4: Most permissive basic video constraints
    attempts.push({
      video: true,
      audio: false,
    });

    let lastError: any = null;
    for (const constraint of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        return stream;
      } catch (err: any) {
        lastError = err;
        // If permission is denied, stop attempting further constraints
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw err;
        }
        // Overconstrained or device not found: try next fallback
        continue;
      }
    }

    throw lastError || new Error('No physical camera device was accessible');
  };

  // Clean up benchmark animation interval if any
  const stopBenchmarkInterval = () => {
    if (benchmarkIntervalRef.current) {
      clearInterval(benchmarkIntervalRef.current);
      benchmarkIntervalRef.current = null;
    }
    benchmarkCanvasRef.current = null;
  };

  // Initialize live camera stream
  useEffect(() => {
    if (mode === SystemMode.REAL_VIDEO_FILE) {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      return;
    }

    stopBenchmarkInterval();
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        await refreshDevices();

        const mediaStream = await acquireCameraStream(selectedDeviceId, facingMode);
        if (!isMounted) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.info('Video stream playback notice:', e));
        }

        // Check torch capability
        const track = mediaStream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps: any = track.getCapabilities();
          setTorchSupported(Boolean(caps.torch));
        } else {
          setTorchSupported(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.info('Camera stream availability notice:', err?.name || err?.message);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Camera access permission was denied. Please allow camera permissions in your browser or select an existing recorded video file to digitize.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'OverconstrainedError' || err.message?.includes('not found')) {
          setCameraError('No physical camera device detected on this system. Connect a webcam, upload a recorded test video, or load the benchmark optical clip below.');
        } else {
          setCameraError(`Camera connection: ${err.message || 'Check camera hardware connection'}`);
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopBenchmarkInterval();
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [mode, selectedDeviceId, facingMode]);

  // Torch toggle handler
  const handleToggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch constraint error:', err);
    }
  };

  // Switch facing mode (environment / user)
  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
    setSelectedDeviceId(''); // reset explicit device id to let facingMode take precedence
  };

  // Load benchmark optical charging video clip
  const handleLoadBenchmarkClip = () => {
    stopBenchmarkInterval();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraError(null);
    if (onModeChange) {
      onModeChange(SystemMode.REAL_VIDEO_FILE);
    }
    setUploadedFileName('Benchmark_Charger_Optical_Feed');

    // Create an animated canvas stream representing real charger optical feed
    const benchCanvas = document.createElement('canvas');
    benchCanvas.width = 1280;
    benchCanvas.height = 720;
    const ctx = benchCanvas.getContext('2d');
    if (!ctx) return;

    let testCharge = 35;
    let testVoltage = 14.1;
    let testCurrent = 5.25;
    let tick = 0;

    const drawFrame = () => {
      tick++;
      if (tick % 30 === 0) {
        if (testCharge < 100) testCharge += 1;
        if (testCharge < 80) {
          testVoltage = Math.min(14.6, 13.8 + (testCharge / 80) * 0.8);
          testCurrent = 5.2 + Math.sin(tick * 0.1) * 0.05;
        } else {
          testVoltage = 14.6;
          testCurrent = Math.max(0.3, 5.2 * (1 - (testCharge - 80) / 20));
        }
      }

      // Render industrial backlit LCD display
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, 1280, 720);

      // Bezel
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.strokeRect(40, 40, 1200, 640);

      // Header
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 30px monospace';
      ctx.fillText('DC CHARGER TELEMETRY DISPLAY', 90, 105);

      ctx.fillStyle = '#334155';
      ctx.fillRect(90, 125, 1100, 3);

      // 1. Voltage Segment
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('VOLTAGE:', 130, 240);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 96px monospace';
      ctx.fillText(`${testVoltage.toFixed(1)} V`, 460, 240);

      // 2. Current Segment
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('CURRENT:', 130, 410);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 96px monospace';
      ctx.fillText(`${testCurrent.toFixed(2)} A`, 460, 410);

      // 3. State of Charge Segment
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('CHARGE %:', 130, 580);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 96px monospace';
      ctx.fillText(`${testCharge} %`, 460, 580);

      // Subtle scanline overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let y = 0; y < 720; y += 4) {
        ctx.fillRect(0, y, 1280, 2);
      }
    };

    drawFrame();
    benchmarkCanvasRef.current = benchCanvas;
    benchmarkIntervalRef.current = window.setInterval(drawFrame, 100);

    // Pipe canvas stream to video element
    if ((benchCanvas as any).captureStream) {
      const benchStream = (benchCanvas as any).captureStream(15);
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.srcObject = benchStream;
        videoRef.current.play().then(() => setIsPlayingVideoFile(true)).catch(e => console.info(e));
      }
    } else {
      setIsPlayingVideoFile(true);
    }
  };

  // Upload real video file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Release previous object url if any
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }

    const url = URL.createObjectURL(file);
    setUploadedVideoUrl(url);
    setUploadedFileName(file.name);
    if (onModeChange) {
      onModeChange(SystemMode.REAL_VIDEO_FILE);
    }

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.playbackRate = videoPlaybackRate;
      videoRef.current.play().then(() => setIsPlayingVideoFile(true)).catch(e => console.warn(e));
    }
  };

  const handleToggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlayingVideoFile(true);
    } else {
      videoRef.current.pause();
      setIsPlayingVideoFile(false);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setVideoPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Periodic frame capture loop
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const displayCanvas = displayCanvasRef.current;
      const video = videoRef.current;
      if (!displayCanvas) return;

      let source: HTMLVideoElement | HTMLCanvasElement | null = null;
      if (video && video.videoWidth > 0 && (video.readyState >= 1 || !video.paused)) {
        source = video;
      } else if (benchmarkCanvasRef.current) {
        source = benchmarkCanvasRef.current;
      }

      if (!source) return;

      // Crop ROI from real video element or benchmark optical feed
      const success = ImageProcessingService.extractRoi(source, roi, displayCanvas);
      if (!success) return;

      const frameQuality = ImageProcessingService.analyzeFrameQuality(displayCanvas);
      setQuality(frameQuality);
      onFrameCaptured(displayCanvas, frameQuality);
    }, samplingIntervalMs);

    return () => clearInterval(interval);
  }, [isCapturing, roi, samplingIntervalMs, onFrameCaptured]);

  // Video time tracking
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
      setVideoDuration(videoRef.current.duration || 0);
    }
  };

  // Preset ROI configurations
  const applyRoiPreset = (preset: 'center' | 'wide' | 'fullscreen' | 'lower') => {
    switch (preset) {
      case 'center':
        onRoiChange({ x: 0.15, y: 0.15, width: 0.7, height: 0.7 });
        break;
      case 'wide':
        onRoiChange({ x: 0.05, y: 0.25, width: 0.9, height: 0.5 });
        break;
      case 'lower':
        onRoiChange({ x: 0.1, y: 0.4, width: 0.8, height: 0.55 });
        break;
      case 'fullscreen':
        onRoiChange({ x: 0.02, y: 0.02, width: 0.96, height: 0.96 });
        break;
    }
  };

  // Mouse drag handler to resize/move ROI box
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setIsDraggingRoi(true);
    setDragStart({ x, y });
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRoi || !dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.max(0.1, Math.abs(currentX - dragStart.x));
    const height = Math.max(0.1, Math.abs(currentY - dragStart.y));

    onRoiChange({
      x: Math.max(0, Math.min(0.9, x)),
      y: Math.max(0, Math.min(0.9, y)),
      width: Math.min(1 - x, width),
      height: Math.min(1 - y, height),
    });
  };

  const handleOverlayMouseUp = () => {
    setIsDraggingRoi(false);
    setDragStart(null);
  };

  return (
    <div id="camera-feed-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      {/* Header & Source Selection */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
              REAL CAMERA OBSERVATION FEED
              {mode === SystemMode.REAL_VIDEO_FILE && (
                <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded font-bold">
                  RECORDED VIDEO FILE
                </span>
              )}
            </h2>
            <span className="text-[11px] text-slate-400">
              {mode === SystemMode.REAL_VIDEO_FILE
                ? `Digitizing: ${uploadedFileName || 'Loaded video session'}`
                : 'Direct optical sensor feed of charger/battery display'}
            </span>
          </div>
        </div>

        {/* Source Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switch to Live Camera */}
          {mode === SystemMode.REAL_VIDEO_FILE ? (
            <button
              onClick={() => {
                if (onModeChange) onModeChange(SystemMode.REAL_CAMERA);
                if (videoRef.current) {
                  videoRef.current.pause();
                  videoRef.current.src = '';
                }
              }}
              className="flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition"
            >
              <Camera className="w-3.5 h-3.5" /> Switch to Live Webcam
            </button>
          ) : (
            <>
              {/* Camera device selection dropdown */}
              {devices.length > 0 && (
                <select
                  id="camera-device-select"
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 max-w-[160px] truncate"
                  title="Select connected camera device"
                >
                  {devices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}

              {/* Facing mode toggle (environment vs user) */}
              <button
                onClick={handleToggleFacingMode}
                title="Toggle front / rear camera"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>

              {/* Torch button if supported */}
              {torchSupported && (
                <button
                  onClick={handleToggleTorch}
                  title="Toggle Camera Flashlight / Torch"
                  className={`p-1.5 rounded border transition ${
                    isTorchOn
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Load Optical Benchmark Clip Button */}
          <button
            onClick={handleLoadBenchmarkClip}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-800 transition"
            title="Load an optical benchmark LCD charging video stream for instant digitization and testing"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Benchmark Clip</span>
          </button>

          {/* Upload Real Video / Image Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
            title="Upload a recorded MP4/WebM video of a charging session or display photo to digitize"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Load Video / Image</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Video Viewport with Interactive ROI Overlay */}
      <div
        id="camera-viewport"
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 select-none cursor-crosshair flex items-center justify-center shadow-inner"
      >
        {cameraError && mode === SystemMode.REAL_CAMERA ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 max-w-md">
            <CameraOff className="w-12 h-12 mb-3 text-rose-400 opacity-90" />
            <p className="text-sm font-semibold text-rose-300 mb-1">{cameraError}</p>
            <p className="text-xs text-slate-400 mb-4">
              If no physical webcam is plugged into this machine, you can digitize an uploaded test video or load the benchmark optical LCD feed below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  setCameraError(null);
                  refreshDevices().then(() => acquireCameraStream(selectedDeviceId, facingMode)).then(mediaStream => {
                    setStream(mediaStream);
                    if (videoRef.current) {
                      videoRef.current.srcObject = mediaStream;
                      videoRef.current.play().catch(e => console.info(e));
                    }
                  }).catch(e => {
                    setCameraError(`Camera connection: ${e.message || 'No camera available'}`);
                  });
                }}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Video
              </button>
              <button
                onClick={handleLoadBenchmarkClip}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> Load Benchmark Clip
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onTimeUpdate={handleVideoTimeUpdate}
            className="w-full h-full object-contain"
          />
        )}

        {/* ROI Box Overlay */}
        <div
          id="roi-bounding-box"
          className="absolute border-2 border-emerald-400 bg-emerald-500/10 pointer-events-none transition-all shadow-[0_0_15px_rgba(16,185,129,0.35)]"
          style={{
            left: `${roi.x * 100}%`,
            top: `${roi.y * 100}%`,
            width: `${roi.width * 100}%`,
            height: `${roi.height * 100}%`,
          }}
        >
          <div className="absolute top-0 left-0 bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 tracking-wider uppercase">
            DISPLAY ROI (OCR TARGET)
          </div>

          {/* Sub-zones if enabled */}
          {zoneConfig.useZones && (
            <div className="w-full h-full relative">
              <div
                className="absolute border border-sky-400 bg-sky-500/20 text-sky-300 text-[9px] font-bold px-1"
                style={{
                  left: `${zoneConfig.voltageZone.x * 100}%`,
                  top: `${zoneConfig.voltageZone.y * 100}%`,
                  width: `${zoneConfig.voltageZone.width * 100}%`,
                  height: `${zoneConfig.voltageZone.height * 100}%`,
                }}
              >
                VOLTAGE (V)
              </div>
              <div
                className="absolute border border-emerald-400 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1"
                style={{
                  left: `${zoneConfig.currentZone.x * 100}%`,
                  top: `${zoneConfig.currentZone.y * 100}%`,
                  width: `${zoneConfig.currentZone.width * 100}%`,
                  height: `${zoneConfig.currentZone.height * 100}%`,
                }}
              >
                CURRENT (A)
              </div>
              <div
                className="absolute border border-amber-400 bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1"
                style={{
                  left: `${zoneConfig.chargeZone.x * 100}%`,
                  top: `${zoneConfig.chargeZone.y * 100}%`,
                  width: `${zoneConfig.chargeZone.width * 100}%`,
                  height: `${zoneConfig.chargeZone.height * 100}%`,
                }}
              >
                CHARGE (%)
              </div>
            </div>
          )}
        </div>

        {/* Drag instructions pill */}
        <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur border border-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded pointer-events-none">
          Drag cursor on display area to frame the LCD/digits
        </div>
      </div>

      {/* Video File Playback Controls (if real video is loaded) */}
      {mode === SystemMode.REAL_VIDEO_FILE && (
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleVideoPlayback}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {isPlayingVideoFile ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Scrub range */}
            <input
              type="range"
              min={0}
              max={videoDuration || 100}
              step={0.1}
              value={videoCurrentTime}
              onChange={e => {
                const t = parseFloat(e.target.value);
                setVideoCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }}
              className="w-full accent-sky-500 cursor-pointer"
            />

            <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
              {Math.floor(videoCurrentTime)}s / {Math.floor(videoDuration)}s
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5 text-sky-400" /> Processing Speed:
            </span>
            <div className="flex items-center gap-1 font-mono">
              {[1, 2, 5, 10].map(speed => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    videoPlaybackRate === speed
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick ROI Alignment Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 font-medium">ROI Alignment Presets:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => applyRoiPreset('center')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Center Display
          </button>
          <button
            onClick={() => applyRoiPreset('wide')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Wide Meter
          </button>
          <button
            onClick={() => applyRoiPreset('lower')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Lower Screen
          </button>
          <button
            onClick={() => applyRoiPreset('fullscreen')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Full Frame
          </button>
        </div>
      </div>

      {/* Frame Quality & Optical Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Display Detection:</span>
          {quality.displayDetected ? (
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> DETECTED
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> NOT DETECTED
            </span>
          )}
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Luminance:</span>
          <span className={quality.isPoorLighting ? 'text-amber-400 font-medium' : 'text-slate-200 font-mono'}>
            {quality.meanLuminance} {quality.isPoorLighting ? '(Poor)' : '(Good)'}
          </span>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Sharpness Score:</span>
          <span className={quality.isBlurry ? 'text-rose-400 font-medium' : 'text-slate-200 font-mono'}>
            {quality.blurScore} {quality.isBlurry ? '(Blurry)' : '(Sharp)'}
          </span>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Capture Rate:</span>
          <span className="text-sky-300 font-mono font-bold">{(1000 / samplingIntervalMs).toFixed(1)} Hz</span>
        </div>
      </div>

      {/* Hidden offscreen canvases for CV extraction */}
      <canvas ref={rawCanvasRef} className="hidden" />
      <canvas ref={displayCanvasRef} className="hidden" />
    </div>
  );
};
