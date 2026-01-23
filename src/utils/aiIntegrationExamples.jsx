/**
 * Improved: AI-assisted Upload & Camera Integration
 * Compatible with fixed utils pipeline
 */

import React from 'react';
import cv from '@techstark/opencv-js';
import { processImage } from './utils/smartCameraAI';

/* ============================================================================
   1. FILE UPLOAD WITH HARD QUALITY BLOCKING
============================================================================ */

export const enhancedHandleFileSelect = async (
  shgId,
  shgName,
  event,
  onResult
) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const img = await loadImageToMat(file);
    const result = processImage(img);

    if (result.status === 'error') {
      onResult?.({
        status: 'error',
        shgId,
        messages: result.messages
      });
      event.target.value = '';
      return;
    }

    const newFile = {
      file,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      shgId,
      shgName,
      warnings: result.warnings,
      validated: true
    };

    onResult?.({ status: 'success', shgId, file: newFile });
    return newFile;

  } catch (err) {
    onResult?.({ status: 'error', shgId, messages: [err.message] });
  }
};

/* ============================================================================
   2. CAMERA CAPTURE WITH AUTO-CROP + QUALITY CHECK
============================================================================ */

export const handleSmartCameraCapture = async (
  videoRef,
  canvasRef,
  onResult
) => {
  if (!videoRef.current || !canvasRef.current) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');

  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;
  ctx.drawImage(videoRef.current, 0, 0);

  const mat = cv.imread(canvas);
  const result = processImage(mat);

  if (result.status === 'error') {
    onResult?.({ status: 'error', messages: result.messages });
    return;
  }

  cv.imshow(canvas, result.image);

  onResult?.({
    status: 'success',
    warnings: result.warnings
  });
};

/* ============================================================================
   3. REAL-TIME SHARPNESS (FOCUS) MONITOR
============================================================================ */

export const useFocusMonitor = (canvasRef) => {
  const [score, setScore] = React.useState(0);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!canvasRef.current) return;

      const mat = cv.imread(canvasRef.current);
      const gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

      const lap = new cv.Mat();
      cv.Laplacian(gray, lap, cv.CV_64F);

      const sharpness = cv.mean(lap)[0];
      setScore(sharpness);

      if (sharpness < 3) setMessage('❌ Very blurry');
      else if (sharpness < 8) setMessage('⚠️ Slight blur');
      else setMessage('✅ Good focus');

      mat.delete();
      gray.delete();
      lap.delete();
    }, 700);

    return () => clearInterval(interval);
  }, []);

  return { score, message };
};

/* ============================================================================
   4. BATCH QUALITY VALIDATION
============================================================================ */

export const assessBatchQuality = async (files) => {
  const results = [];

  for (const file of files) {
    try {
      const mat = await loadImageToMat(file);
      const result = processImage(mat);

      results.push({
        fileName: file.name,
        passed: result.status === 'success',
        errors: result.messages ?? [],
        warnings: result.warnings ?? []
      });

    } catch (e) {
      results.push({
        fileName: file.name,
        passed: false,
        errors: [e.message]
      });
    }
  }

  return results;
};

/* ============================================================================
   5. UI COMPONENTS
============================================================================ */

export const QualityIndicator = ({ errors = [], warnings = [] }) => {
  if (errors.length > 0) {
    return <div className="text-red-600">❌ Image rejected</div>;
  }
  if (warnings.length > 0) {
    return <div className="text-yellow-600">⚠️ Minor issues</div>;
  }
  return <div className="text-green-600">✅ Good quality</div>;
};

export const IssuesDisplay = ({ errors = [], warnings = [] }) => (
  <div>
    {errors.map((e, i) => (
      <div key={i} className="text-red-600">• {e}</div>
    ))}
    {warnings.map((w, i) => (
      <div key={i} className="text-yellow-600">• {w}</div>
    ))}
  </div>
);

/* ============================================================================
   6. HELPERS
============================================================================ */

const loadImageToMat = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(cv.imread(canvas));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

export default {
  enhancedHandleFileSelect,
  handleSmartCameraCapture,
  useFocusMonitor,
  assessBatchQuality,
  QualityIndicator,
  IssuesDisplay
};
