/**
 * Enhanced Smart Camera with AI Features (FIXED VERSION)
 * Stable quality checks, document-safe brightness logic,
 * robust edge detection, and strict capture blocking
 */

import { getRealtimeQualityFeedback } from './aiModels';

/* ---------------- CAMERA QUALITY MONITOR ---------------- */

export class CameraQualityMonitor {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext('2d');
    this.feedbackCallback = null;
    this.monitoringInterval = null;
  }

  startMonitoring(feedbackCallback) {
    this.feedbackCallback = feedbackCallback;

    if (this.monitoringInterval) clearInterval(this.monitoringInterval);

    this.monitoringInterval = setInterval(() => {
      if (this.video?.readyState === 4) {
        this.analyzeFrame();
      }
    }, 400);
  }

  stopMonitoring() {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
  }

  analyzeFrame() {
    try {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.ctx.drawImage(this.video, 0, 0);

      const feedback = getRealtimeQualityFeedback(this.canvas);

      // ❌ Block false brightness errors for document-like images
      if (
        feedback?.brightness?.normalized > 0.9 &&
        feedback?.sharpness?.score > 0.45
      ) {
        feedback.brightness.status = 'ok';
      }

      this.feedbackCallback?.(feedback);
    } catch (e) {
      console.error('Camera frame analysis failed', e);
    }
  }
}

/* ---------------- DOCUMENT EDGE DETECTOR ---------------- */

export class DocumentEdgeDetector {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext('2d');
  }

  drawEdges(imageData) {
    const edges = this.detectEdges(imageData);
    this.renderEdges(edges, imageData.width, imageData.height);
  }

  detectEdges(imageData) {
    const { data, width, height } = imageData;
    const edges = [];

    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    const gray = new Float32Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const val = gray[(y + ky) * width + (x + kx)];
            gx += sobelX[k] * val;
            gy += sobelY[k] * val;
            k++;
          }
        }

        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > 120) edges.push({ x, y, mag });
      }
    }
    return edges;
  }

  renderEdges(edges, width, height) {
    if (!this.canvas) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = 'rgba(0,255,0,0.8)';
    edges.forEach((e, i) => {
      if (i % 6 === 0) this.ctx.fillRect(e.x, e.y, 2, 2);
    });
  }
}

/* ---------------- SMART FOCUS GUIDE ---------------- */

export class SmartFocusGuide {
  calculateFocusScore(imageData) {
    const data = imageData.data;
    let variance = 0;
    let mean = 0;

    for (let i = 0; i < data.length; i += 16) {
      mean += data[i];
    }
    mean /= (data.length / 16);

    for (let i = 0; i < data.length; i += 16) {
      variance += Math.pow(data[i] - mean, 2);
    }

    const score = Math.min(1, variance / 6000);
    return score;
  }

  getFocusGuidance(score) {
    if (score < 0.35)
      return { status: 'blurry', message: 'Hold camera steady', color: 'red' };

    if (score < 0.6)
      return { status: 'adjusting', message: 'Adjust focus', color: 'orange' };

    return { status: 'focused', message: 'Ready', color: 'green' };
  }
}

/* ---------------- CAPTURE OPTIMIZER ---------------- */

export class CaptureOptimizer {
  isReadyForCapture({ focus, brightness, contrast }) {
    const errors = [];

    if (focus < 0.6) errors.push('Image is blurry');
    if (brightness < 70 || brightness > 240)
      errors.push('Lighting not suitable');
    if (contrast < 0.25) errors.push('Low contrast');

    return {
      ready: errors.length === 0,
      errors
    };
  }
}

/* ---------------- ENHANCEMENT SUGGESTIONS ---------------- */

export class EnhancementSuggestions {
  static generateSuggestions({ quality, documentBounds }) {
    const s = [];

    if (quality.brightness.normalized < 0.25)
      s.push('Increase lighting');

    if (quality.contrast.score < 0.3)
      s.push('Improve contrast');

    if (quality.sharpness.score < 0.5)
      s.push('Stabilize camera');

    if (!documentBounds?.detected)
      s.push('Align document fully in frame');

    return s;
  }
}

/* ---------------- GESTURE CONTROL (SAFE) ---------------- */

export class GestureControl {
  detectOKGesture(hands) {
    if (!hands?.length) return false;

    return hands.some(h => {
      const t = h.landmarks?.[4];
      const i = h.landmarks?.[8];
      if (!t || !i) return false;
      return Math.hypot(t.x - i.x, t.y - i.y) < 0.04;
    });
  }
}

export default {
  CameraQualityMonitor,
  DocumentEdgeDetector,
  SmartFocusGuide,
  CaptureOptimizer,
  EnhancementSuggestions,
  GestureControl
};
