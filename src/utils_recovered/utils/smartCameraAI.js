/**
 * Enhanced Smart Camera with AI Features
 * Real-time quality monitoring, document detection, and auto-adjustments
 */

import { getRealtimeQualityFeedback } from './aiModels';

/**
 * Real-time camera quality monitor
 * Provides live feedback while user is framing the document
 */
export class CameraQualityMonitor {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext('2d');
    this.feedbackCallback = null;
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start real-time quality monitoring
   */
  startMonitoring(feedbackCallback) {
    this.feedbackCallback = feedbackCallback;
    this.isMonitoring = true;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Check quality every 500ms for smooth feedback
    this.monitoringInterval = setInterval(() => {
      if (this.video?.readyState === 4) { // Video is ready
        this.analyzeFrame();
      }
    }, 500);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Analyze current video frame
   */
  analyzeFrame() {
    try {
      // Resize canvas to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      // Draw current frame
      this.ctx.drawImage(this.video, 0, 0);

      // Get real-time feedback
      const feedback = getRealtimeQualityFeedback(this.canvas);

      if (this.feedbackCallback) {
        this.feedbackCallback(feedback);
      }
    } catch (err) {
      console.error('Frame analysis error:', err);
    }
  }
}

/**
 * Document edge detection for camera preview
 * Highlights document boundaries in real-time
 */
export class DocumentEdgeDetector {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext('2d');
  }

  /**
   * Draw detected edges on canvas overlay
   */
  drawEdges(imageData) {
    const edges = this.detectEdges(imageData);
    this.renderEdges(edges, imageData.width, imageData.height);
  }

  /**
   * Simple edge detection
   */
  detectEdges(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const threshold = 100;
    const edges = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        const gx =
          (-data[(y - 1) * width * 4 + (x - 1) * 4] + data[(y - 1) * width * 4 + (x + 1) * 4]) +
          (-2 * data[y * width * 4 + (x - 1) * 4] + 2 * data[y * width * 4 + (x + 1) * 4]) +
          (-data[(y + 1) * width * 4 + (x - 1) * 4] + data[(y + 1) * width * 4 + (x + 1) * 4]);

        const gy =
          (-data[(y - 1) * width * 4 + (x - 1) * 4] - 2 * data[(y - 1) * width * 4 + x * 4] - data[(y - 1) * width * 4 + (x + 1) * 4]) +
          (data[(y + 1) * width * 4 + (x - 1) * 4] + 2 * data[(y + 1) * width * 4 + x * 4] + data[(y + 1) * width * 4 + (x + 1) * 4]);

        const magnitude = Math.sqrt(gx * gx + gy * gy);

        if (magnitude > threshold) {
          edges.push({ x, y, magnitude });
        }
      }
    }

    return edges;
  }

  /**
   * Render edges on overlay canvas
   */
  renderEdges(edges, width, height) {
    if (!this.canvas) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.clearRect(0, 0, width, height);

    // Set color and draw edges
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 2;

    edges.forEach((edge, idx) => {
      if (idx % 5 === 0) { // Draw every 5th point to reduce density
        this.ctx.fillStyle = `rgba(0, 255, 0, ${Math.min(1, edge.magnitude / 200)})`;
        this.ctx.fillRect(edge.x, edge.y, 2, 2);
      }
    });
  }
}

/**
 * Smart focus detection
 * Analyzes frame sharpness and guides user to focus
 */
export class SmartFocusGuide {
  constructor() {
    this.focusHistory = [];
    this.maxHistorySize = 10;
  }

  /**
   * Calculate focus score (0-1)
   */
  calculateFocusScore(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    let edgeEnergy = 0;

    // Sample edges at regular intervals for performance
    const step = 4;
    for (let i = 0; i < data.length; i += step * 4) {
      const idx = i;
      const nextIdx = Math.min(i + 4, data.length - 1);

      const c1 = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const c2 = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;

      edgeEnergy += Math.abs(c1 - c2);
    }

    const normalizedScore = Math.min(1, edgeEnergy / (data.length / 100));
    return normalizedScore;
  }

  /**
   * Get focus guidance
   */
  getFocusGuidance(focusScore) {
    if (focusScore < 0.3) {
      return {
        status: 'blurry',
        message: '🫂 Keep camera steady',
        icon: '❌',
        color: 'red'
      };
    } else if (focusScore < 0.6) {
      return {
        status: 'adjusting',
        message: '⏳ Adjusting focus...',
        icon: '⚠️',
        color: 'orange'
      };
    } else {
      return {
        status: 'focused',
        message: '✅ Ready to capture',
        icon: '✅',
        color: 'green'
      };
    }
  }

  /**
   * Add focus score to history and get trend
   */
  updateHistory(focusScore) {
    this.focusHistory.push(focusScore);
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory.shift();
    }

    // Check if improving or stable
    if (this.focusHistory.length >= 3) {
      const recent = this.focusHistory.slice(-3);
      const isImproving = recent[2] > recent[1] && recent[1] >= recent[0];
      const isStable = Math.abs(recent[2] - recent[1]) < 0.05;

      return {
        isImproving,
        isStable,
        trend: isImproving ? 'up' : 'down'
      };
    }

    return { isImproving: false, isStable: false, trend: 'none' };
  }
}

/**
 * Intelligent capture optimizer
 * Automatically suggests best moment to capture
 */
export class CaptureOptimizer {
  constructor() {
    this.metrics = [];
    this.readyToCapture = false;
  }

  /**
   * Check if conditions are optimal for capture
   */
  isReadyForCapture(focusScore, brightness, contrast) {
    const metrics = {
      focus: focusScore > 0.6,
      brightness: brightness > 80 && brightness < 200,
      contrast: contrast > 0.3,
      timestamp: Date.now()
    };

    this.metrics.push(metrics);

    // Keep last 5 measurements
    if (this.metrics.length > 5) {
      this.metrics.shift();
    }

    // Consider ready if last 3 measurements are all good
    if (this.metrics.length >= 3) {
      const recent = this.metrics.slice(-3);
      this.readyToCapture = recent.every(m => m.focus && m.brightness && m.contrast);
    }

    return {
      ready: this.readyToCapture,
      metrics,
      reason: this.getReadyReason(metrics)
    };
  }

  /**
   * Get human-readable reason
   */
  getReadyReason(metrics) {
    if (!metrics.focus) return 'Image is blurry';
    if (!metrics.brightness) return 'Adjust lighting';
    if (!metrics.contrast) return 'Improve contrast';
    return 'Ready to capture';
  }
}

/**
 * Auto-enhancement suggestions
 * Suggests image enhancements based on analysis
 */
export class EnhancementSuggestions {
  static generateSuggestions(analysisResult) {
    const suggestions = [];

    const { quality, orientation, documentBounds } = analysisResult;

    // Brightness suggestions
    if (quality.brightness.normalized < 0.3) {
      suggestions.push({
        type: 'brightness',
        action: 'increase',
        severity: 'high',
        message: 'Image is too dark - increase brightness'
      });
    } else if (quality.brightness.normalized > 0.85) {
      suggestions.push({
        type: 'brightness',
        action: 'decrease',
        severity: 'medium',
        message: 'Image is overexposed - reduce brightness'
      });
    }

    // Contrast suggestions
    if (quality.contrast.score < 0.3) {
      suggestions.push({
        type: 'contrast',
        action: 'increase',
        severity: 'high',
        message: 'Low contrast - improve lighting'
      });
    }

    // Focus suggestions
    if (quality.sharpness.score < 0.5) {
      suggestions.push({
        type: 'focus',
        action: 'improve',
        severity: 'high',
        message: 'Image is not sharp - ensure steady camera'
      });
    }

    // Orientation suggestions
    if (orientation.isPortrait) {
      suggestions.push({
        type: 'orientation',
        action: 'rotate',
        severity: 'medium',
        angle: 90,
        message: 'Document appears to be in portrait - rotate to landscape'
      });
    }

    // Document framing
    if (!documentBounds.detected) {
      suggestions.push({
        type: 'framing',
        action: 'reframe',
        severity: 'high',
        message: 'Document not properly detected - ensure full document is visible'
      });
    }

    return suggestions;
  }
}

/**
 * Gesture recognition for camera control (bonus feature)
 * Detect hand gestures to control capture
 */
export class GestureControl {
  constructor() {
    this.gestureHistory = [];
  }

  /**
   * Detect if user is showing "OK" gesture (for hands-free capture)
   */
  detectOKGesture(detectedHands) {
    // This would integrate with MediaPipe Hands API
    // Simplified version for now
    if (!detectedHands || detectedHands.length === 0) {
      return false;
    }

    // Check if thumb and fingers form OK shape
    return detectedHands.some(hand => {
      const handedness = hand.handedness;
      const landmarks = hand.landmarks;

      if (landmarks.length < 9) return false;

      // Simplified OK gesture: thumb and index close, other fingers extended
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const distance = this.euclideanDistance(thumbTip, indexTip);

      return distance < 0.05; // Threshold for "OK"
    });
  }

  /**
   * Calculate Euclidean distance
   */
  euclideanDistance(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2)
    );
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
