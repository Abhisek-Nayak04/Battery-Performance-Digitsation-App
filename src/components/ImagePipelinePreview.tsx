/**
 * Image Preprocessing Pipeline Visualizer & Controls
 * Displays the cropped ROI and binarized frame fed into OCR.
 */

import React, { useEffect, useRef } from 'react';
import { Sliders, Eye } from 'lucide-react';
import { ImagePreprocessingConfig } from '../types/charging';
import { ImageProcessingService } from '../services/imageProcessing';

interface ImagePipelinePreviewProps {
  sourceDisplayCanvas: HTMLCanvasElement | null;
  config: ImagePreprocessingConfig;
  onConfigChange: (config: ImagePreprocessingConfig) => void;
  rawOcrText: string;
}

export const ImagePipelinePreview: React.FC<ImagePipelinePreviewProps> = ({
  sourceDisplayCanvas,
  config,
  onConfigChange,
  rawOcrText,
}) => {
  const preprocessedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-run preprocessing whenever sourceDisplayCanvas or config changes
  useEffect(() => {
    if (!sourceDisplayCanvas || !preprocessedCanvasRef.current) return;
    ImageProcessingService.preprocessImage(
      sourceDisplayCanvas,
      preprocessedCanvasRef.current,
      config
    );
  }, [sourceDisplayCanvas, config]);

  return (
    <div id="image-pipeline-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold tracking-wide text-slate-200 uppercase">
            CV Preprocessing & OCR Binarization
          </h2>
        </div>
      </div>

      {/* Preprocessing Canvases Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Cropped Display ROI (Raw):</span>
          <div className="h-28 bg-black rounded border border-slate-800 flex items-center justify-center overflow-hidden p-1">
            {sourceDisplayCanvas ? (
              <img
                src={sourceDisplayCanvas.toDataURL()}
                alt="Cropped ROI"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-600">Awaiting capture...</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Preprocessed OCR Input (Binarized):</span>
          <div className="h-28 bg-black rounded border border-slate-800 flex items-center justify-center overflow-hidden p-1">
            <canvas ref={preprocessedCanvasRef} className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      </div>

      {/* Raw OCR Text readout */}
      <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase font-mono">Last Raw OCR Output:</span>
        <div className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all min-h-[1.5rem]">
          {rawOcrText ? rawOcrText.trim() : <span className="text-slate-600 italic">No text recognized yet</span>}
        </div>
      </div>

      {/* Preprocessing Tuning Sliders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
        <div>
          <label className="text-[11px] text-slate-400 flex justify-between">
            <span>Contrast:</span>
            <span className="font-mono text-slate-300">{config.contrast}%</span>
          </label>
          <input
            id="contrast-slider"
            type="range"
            min="-100"
            max="100"
            value={config.contrast}
            onChange={e => onConfigChange({ ...config, contrast: parseInt(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 flex justify-between">
            <span>Brightness:</span>
            <span className="font-mono text-slate-300">{config.brightness}%</span>
          </label>
          <input
            id="brightness-slider"
            type="range"
            min="-100"
            max="100"
            value={config.brightness}
            onChange={e => onConfigChange({ ...config, brightness: parseInt(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 pt-3">
          <input
            id="invert-checkbox"
            type="checkbox"
            checked={config.invert}
            onChange={e => onConfigChange({ ...config, invert: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="invert-checkbox" className="text-[11px] text-slate-300 cursor-pointer">
            Invert Digits (Dark LCD)
          </label>
        </div>

        <div className="flex items-center gap-2 pt-3">
          <input
            id="sharpen-checkbox"
            type="checkbox"
            checked={config.sharpen}
            onChange={e => onConfigChange({ ...config, sharpen: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="sharpen-checkbox" className="text-[11px] text-slate-300 cursor-pointer">
            Sharpen Edges
          </label>
        </div>
      </div>
    </div>
  );
};
