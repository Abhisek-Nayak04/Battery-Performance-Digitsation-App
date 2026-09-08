/**
 * Image Preprocessing & Display Detection Service
 * Performs canvas-based computer vision operations:
 * ROI extraction, brightness/contrast, sharpening, thresholding, blur & lighting analysis.
 */

import { ImagePreprocessingConfig, RegionOfInterest } from '../types/charging';

export interface FrameQualityAnalysis {
  meanLuminance: number;       // 0 to 255
  isPoorLighting: boolean;
  blurScore: number;           // Higher = sharper
  isBlurry: boolean;
  displayDetected: boolean;
}

export class ImageProcessingService {
  /**
   * Crop a normalized Region of Interest from an HTMLVideoElement or Canvas
   */
  static extractRoi(
    source: HTMLVideoElement | HTMLCanvasElement,
    roi: RegionOfInterest,
    targetCanvas: HTMLCanvasElement
  ): boolean {
    const srcWidth = 'videoWidth' in source ? source.videoWidth : source.width;
    const srcHeight = 'videoHeight' in source ? source.videoHeight : source.height;

    if (!srcWidth || !srcHeight) return false;

    const sx = Math.max(0, Math.min(srcWidth, roi.x * srcWidth));
    const sy = Math.max(0, Math.min(srcHeight, roi.y * srcHeight));
    const sw = Math.max(10, Math.min(srcWidth - sx, roi.width * srcWidth));
    const sh = Math.max(10, Math.min(srcHeight - sy, roi.height * srcHeight));

    targetCanvas.width = sw;
    targetCanvas.height = sh;

    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    return true;
  }

  /**
   * Analyze frame quality: Lighting levels and blurriness using variance of Laplacian
   */
  static analyzeFrameQuality(canvas: HTMLCanvasElement): FrameQualityAnalysis {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      return {
        meanLuminance: 0,
        isPoorLighting: true,
        blurScore: 0,
        isBlurry: true,
        displayDetected: false,
      };
    }

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let totalLuminance = 0;
    const gray: number[] = new Array(width * height);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // ITU-R BT.601 luma formula
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[p] = luma;
      totalLuminance += luma;
    }

    const meanLuminance = totalLuminance / (width * height);
    // Allow wide lighting range typical of backlit LCDs, OLEDs, and dimly lit lab environments
    const isPoorLighting = meanLuminance < 8 || meanLuminance > 248;

    // Fast discrete Laplacian variance on a subsampled grid for blur detection
    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let laplacianCount = 0;

    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        const center = gray[y * width + x];
        const up = gray[(y - 1) * width + x];
        const down = gray[(y + 1) * width + x];
        const left = gray[y * width + (x - 1)];
        const right = gray[y * width + (x + 1)];

        // Standard 3x3 discrete Laplacian operator: center * 4 - (up + down + left + right)
        const lap = Math.abs(center * 4 - up - down - left - right);
        laplacianSum += lap;
        laplacianSqSum += lap * lap;
        laplacianCount++;
      }
    }

    const meanLap = laplacianSum / Math.max(1, laplacianCount);
    const blurScore = (laplacianSqSum / Math.max(1, laplacianCount)) - (meanLap * meanLap);
    const isBlurry = blurScore < 5;

    // Display detection: frame contains visible light contrast (not a covered black lens)
    const displayDetected = meanLuminance >= 6 && meanLuminance <= 250;

    return {
      meanLuminance: Math.round(meanLuminance),
      isPoorLighting,
      blurScore: Math.round(blurScore * 10) / 10,
      isBlurry,
      displayDetected,
    };
  }

  /**
   * Apply image processing pipeline to optimize display text for OCR
   */
  static preprocessImage(
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement,
    config: ImagePreprocessingConfig
  ): void {
    const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx || sourceCanvas.width === 0 || sourceCanvas.height === 0) return;

    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    const tgtCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
    if (!tgtCtx) return;

    // Draw source
    tgtCtx.drawImage(sourceCanvas, 0, 0);

    const imgData = tgtCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
    const data = imgData.data;
    const len = data.length;

    // Brightness [-100, 100] & Contrast [-100, 100]
    const b = (config.brightness / 100) * 255;
    const c = (config.contrast + 100) / 100; // factor
    const cFactor = (c * c);

    // Compute grayscale and luminance histogram
    const histogram = new Array(256).fill(0);
    const grayData = new Uint8ClampedArray(targetCanvas.width * targetCanvas.height);
    let totalGray = 0;

    for (let i = 0, p = 0; i < len; i += 4, p++) {
      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // Apply brightness & contrast
      gray = cFactor * (gray - 128) + 128 + b;
      gray = Math.max(0, Math.min(255, gray));

      grayData[p] = gray;
      totalGray += gray;
      histogram[Math.floor(gray)]++;
    }

    const avgLuma = totalGray / grayData.length;
    // Auto detect dark background (e.g. OLED, backlit blue/black LCD)
    // Tesseract is trained for dark text on white/light background.
    const shouldInvert = config.invert || (config.threshold === 0 && avgLuma < 120);

    // If manual thresholding is specified (> 0)
    if (config.threshold > 0) {
      const thresh = config.threshold;
      for (let p = 0, i = 0; p < grayData.length; p++, i += 4) {
        let val = grayData[p] >= thresh ? 255 : 0;
        if (config.invert) val = 255 - val;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
    } else {
      // Auto mode (threshold === 0):
      // Enhance contrast with smooth anti-aliased gradients and normalize polarity
      // Find 5th and 95th percentiles for dynamic range stretching
      let count = 0;
      let pLow = 0;
      let pHigh = 255;
      const targetLow = grayData.length * 0.05;
      const targetHigh = grayData.length * 0.95;

      for (let k = 0; k < 256; k++) {
        count += histogram[k];
        if (count >= targetLow && pLow === 0) pLow = k;
        if (count >= targetHigh) { pHigh = k; break; }
      }
      const range = Math.max(1, pHigh - pLow);

      for (let p = 0, i = 0; p < grayData.length; p++, i += 4) {
        let val = ((grayData[p] - pLow) / range) * 255;
        val = Math.max(0, Math.min(255, val));

        if (shouldInvert) {
          val = 255 - val;
        }

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
    }

    tgtCtx.putImageData(imgData, 0, 0);

    // Sharpening filter if enabled
    if (config.sharpen) {
      this.applySharpen(targetCanvas);
    }
  }

  /**
   * Otsu's thresholding algorithm for automatic bimodal separation
   */
  private static computeOtsuThreshold(histogram: number[], totalPixels: number): number {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }

    return threshold;
  }

  /**
   * 3x3 Sharpen convolution kernel
   */
  private static applySharpen(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const srcData = ctx.getImageData(0, 0, w, h);
    const dstData = ctx.createImageData(w, h);
    const src = srcData.data;
    const dst = dstData.data;

    // Kernel:
    //  0 -1  0
    // -1  5 -1
    //  0 -1  0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const up = ((y - 1) * w + x) * 4;
        const down = ((y + 1) * w + x) * 4;
        const left = (y * w + (x - 1)) * 4;
        const right = (y * w + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val = 5 * src[idx + c] - src[up + c] - src[down + c] - src[left + c] - src[right + c];
          dst[idx + c] = Math.max(0, Math.min(255, val));
        }
        dst[idx + 3] = 255;
      }
    }

    ctx.putImageData(dstData, 0, 0);
  }
}
