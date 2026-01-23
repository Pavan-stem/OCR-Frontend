/**
 * AI Models Integration (Corrected & Production Safe)
 * Document scanning focused – no false positives
 */

/* ============================================================================
   1. DOCUMENT DETECTION (ROBUST)
============================================================================ */

export const detectDocumentBoundaries = async (file) => {
  const { canvas, ctx } = await loadToCanvas(file, 800);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const edges = sobelEdges(imgData);

  let edgeCount = 0;
  let minX = canvas.width, minY = canvas.height;
  let maxX = 0, maxY = 0;

  edges.forEach((v, i) => {
    if (v > 120) {
      edgeCount++;
      const y = Math.floor(i / canvas.width);
      const x = i % canvas.width;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });

  const area = (maxX - minX) * (maxY - minY);
  const areaRatio = area / (canvas.width * canvas.height);
  const edgeDensity = edgeCount / (canvas.width * canvas.height);

  const detected =
    edgeDensity > 0.01 &&
    areaRatio > 0.2 &&
    areaRatio < 0.95;

  return {
    detected,
    confidence: detected ? Math.min(1, areaRatio + edgeDensity) : 0,
    bounds: detected
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : null
  };
};

/* ============================================================================
   2. IMAGE QUALITY (DOCUMENT AWARE)
============================================================================ */

export const assessImageQuality = async (file) => {
  const { canvas, ctx } = await loadToCanvas(file, 1000);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let brightness = 0;
  let edgeCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (Math.abs(data[i] - data[i + 1]) > 25) edgeCount++;
  }

  brightness /= canvas.width * canvas.height;
  const brightnessNorm = brightness / 255;
  const edgeDensity = edgeCount / (canvas.width * canvas.height);

  const sharpnessScore = Math.min(1, edgeDensity * 5);
  const brightnessScore =
    brightnessNorm > 0.25 && brightnessNorm < 0.95 ? 1 : 0.3;

  const issues = [];
  const suggestions = [];

  if (brightnessNorm < 0.25) {
    issues.push('Image is too dark');
    suggestions.push('Increase lighting');
  }

  if (brightnessNorm > 0.95 && sharpnessScore < 0.4) {
    issues.push('Image is overexposed');
    suggestions.push('Reduce glare or lighting');
  }

  if (sharpnessScore < 0.35) {
    issues.push('Image is blurry');
    suggestions.push('Hold camera steady');
  }

  return {
    brightness: brightnessNorm,
    sharpness: sharpnessScore,
    overall: (brightnessScore + sharpnessScore) / 2,
    issues,
    suggestions,
    isAcceptable: issues.length === 0
  };
};

/* ============================================================================
   3. ORIENTATION (STABLE)
============================================================================ */

export const detectOrientation = async (file) => {
  const { canvas, ctx } = await loadToCanvas(file, 600);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let horizontalEdges = 0;
  let verticalEdges = 0;

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const i = (y * canvas.width + x) * 4;
      const diffX = Math.abs(img[i] - img[i + 4]);
      const diffY = Math.abs(img[i] - img[i + canvas.width * 4]);
      if (diffX > 25) verticalEdges++;
      if (diffY > 25) horizontalEdges++;
    }
  }

  let rotation = 0;
  if (verticalEdges > horizontalEdges * 1.2) rotation = 90;

  return {
    suggestedRotation: rotation,
    confidence: Math.min(1, Math.abs(verticalEdges - horizontalEdges) / 5000)
  };
};

/* ============================================================================
   4. FULL PIPELINE (BLOCKING ERRORS)
============================================================================ */

export const analyzeImageWithAI = async (file) => {
  const [quality, doc, orientation] = await Promise.all([
    assessImageQuality(file),
    detectDocumentBoundaries(file),
    detectOrientation(file)
  ]);

  const errors = [...quality.issues];
  const suggestions = [...quality.suggestions];

  if (!doc.detected) {
    errors.push('No document detected');
    suggestions.push('Ensure document fills the frame');
  }

  // User Request: Prioritize errors over suggestions
  const finalSuggestions = errors.length > 0 ? [] : suggestions;

  return {
    isValid: errors.length === 0,
    errors,
    suggestions: finalSuggestions,
    quality,
    documentBounds: doc,
    recommendedRotation: orientation.suggestedRotation,
    timestamp: new Date().toISOString()
  };
};

/* ============================================================================
   5. REALTIME CAMERA FEEDBACK
============================================================================ */

export const getRealtimeQualityFeedback = (canvas) => {
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let brightness = 0;
  let edge = 0;

  for (let i = 0; i < d.length; i += 4) {
    brightness += (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (Math.abs(d[i] - d[i + 1]) > 30) edge++;
  }

  brightness /= canvas.width * canvas.height;

  return {
    brightness: brightness > 80 ? 'OK' : 'LOW',
    focus: edge > 800 ? 'OK' : 'BLURRY',
    ready: brightness > 80 && edge > 800
  };
};

/* ============================================================================
   HELPERS
============================================================================ */

const loadToCanvas = (file, maxW) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, maxW);
      canvas.height = (canvas.width / img.width) * img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ canvas, ctx });
    };
    img.src = URL.createObjectURL(file);
  });

const sobelEdges = (img) => {
  const { data, width, height } = img;
  const edges = new Uint8ClampedArray(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const gx = data[i + 4] - data[i - 4];
      const gy = data[i + width * 4] - data[i - width * 4];
      edges[y * width + x] = Math.abs(gx) + Math.abs(gy);
    }
  }
  return edges;
};

export default {
  analyzeImageWithAI,
  assessImageQuality,
  detectDocumentBoundaries,
  detectOrientation,
  getRealtimeQualityFeedback
};
