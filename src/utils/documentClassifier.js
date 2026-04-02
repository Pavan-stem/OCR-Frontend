// src/utils/documentClassifier.js

function safeDelete(obj) {
  try {
    if (obj && typeof obj.delete === 'function') obj.delete();
  } catch (_) { }
}

function getContourRects(binaryMat) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const rects = [];

  try {
    cv.findContours(
      binaryMat,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const rect = cv.boundingRect(cnt);
      rects.push(rect);
      cnt.delete();
    }
  } finally {
    safeDelete(contours);
    safeDelete(hierarchy);
  }

  return rects;
}

function mergeCloseLines(rects, axis, tolerance, minTotalLength) {
  if (rects.length === 0) return 0;

  // Use x for vertical, y for horizontal
  const sorted = [...rects].sort((a, b) => a[axis] - b[axis]);

  let count = 0;
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    let totalLength = axis === 'x' ? sorted[i].height : sorted[j-1].width; // Wait, typo in my thought, fixing below
    
    // Actually axis === 'x' ? height : width
    totalLength = axis === 'x' ? sorted[i].height : sorted[i].width;

    while (j < sorted.length && (sorted[j][axis] - sorted[j-1][axis]) <= tolerance) {
      totalLength += (axis === 'x' ? sorted[j].height : sorted[j].width);
      j++;
    }

    if (totalLength >= minTotalLength) {
      count++;
    }
    i = j;
  }
  return count;
}

function detectLineMasks(srcMat) {
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const horizontal = new cv.Mat();
  const vertical = new cv.Mat();

  try {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);

    cv.adaptiveThreshold(
      gray,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      4
    );

    binary.copyTo(horizontal);
    binary.copyTo(vertical);

    const horizontalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(Math.max(25, Math.floor(srcMat.cols / 30)), 1)
    );

    const verticalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(1, Math.max(25, Math.floor(srcMat.rows / 30)))
    );

    cv.erode(horizontal, horizontal, horizontalKernel);
    cv.dilate(horizontal, horizontal, horizontalKernel);

    cv.erode(vertical, vertical, verticalKernel);
    cv.dilate(vertical, vertical, verticalKernel);

    horizontalKernel.delete();
    verticalKernel.delete();

    return { gray, binary, horizontal, vertical };
  } catch (err) {
    safeDelete(gray);
    safeDelete(binary);
    safeDelete(horizontal);
    safeDelete(vertical);
    throw err;
  }
}

function extractLineFeatures(mat) {
  const { gray, binary, horizontal, vertical } = detectLineMasks(mat);

  try {
    const width = mat.cols;
    const height = mat.rows;

    const vRects = getContourRects(vertical);
    const hRects = getContourRects(horizontal);

    // Precise Line Detection:
    // 1. Vertical (Columns): Use a smaller tolerance (4px - 8px) so close columns aren't merged. 
    //    Each must total at least 35% of image height to be counted.
    const verticalCount = mergeCloseLines(
      vRects,
      'x',
      Math.max(4, Math.floor(width * 0.005)), // ~10px at 2000px, prevents merging adjacent columns
      Math.floor(height * 0.35)             // Must cover 35% of total height (avoids text noise)
    );

    // 2. Horizontal (Rows): Use ~15-20px tolerance. 
    //    Each must total at least 30% of image width.
    const horizontalCount = mergeCloseLines(
      hRects,
      'y',
      Math.max(4, Math.floor(height * 0.008)), // ~12px at 1500px, prevents merging narrow rows
      Math.floor(width * 0.3)                // Must cover 30% of total width
    );

    return {
      width,
      height,
      verticalCount,
      horizontalCount
    };
  } finally {
    safeDelete(gray);
    safeDelete(binary);
    safeDelete(horizontal);
    safeDelete(vertical);
  }
}

/**
 * RESTORED FOR COMPATIBILITY with SmartCamera.jsx
 */

let _selectedPage = 1;
export function setSelectedPage(page) {
  _selectedPage = page;
}

function imageToCanvas(imageSource) {
  return new Promise((resolve, reject) => {
    if (imageSource instanceof HTMLCanvasElement) {
      return resolve(imageSource);
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      resolve(canvas);
    };
    img.onerror = reject;

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    } else {
      reject(new Error('Unsupported image source'));
    }
  });
}

export async function classifyImage(imageInput) {
  let mat = null;
  try {
    const canvas = await imageToCanvas(imageInput);
    mat = cv.imread(canvas);

    if (mat.rows > mat.cols) {
      return {
        cls: 'REJECTED',
        confidence: 0,
        reason: 'Portrait orientation detected.',
        features: {},
        degrees: 0,
        tableDetected: false
      };
    }

    const res = classifyDocumentByLines(mat);

    if (!res.ok) {
      return {
        cls: 'REJECTED',
        confidence: 0,
        reason: res.message,
        features: res.details || {},
        degrees: 0,
        tableDetected: false
      };
    }

    return {
      cls: res.type,
      confidence: 0.9,
      reason: res.message,
      features: res.details || {},
      degrees: 0,
      tableDetected: true
    };
  } catch (err) {
    console.error('classifyImage error:', err);
    return {
      cls: 'REJECTED',
      confidence: 0,
      reason: 'Classification failed',
      features: {},
      degrees: 0,
      tableDetected: false
    };
  } finally {
    safeDelete(mat);
  }
}

export function validatePage(classificationStatus, expectedPage) {
  const expectedCls = 'PAGE' + expectedPage;
  return classificationStatus === expectedCls
    ? { ok: true }
    : { ok: false, errorType: 'slot_mismatch', msg: '' };
}

export function classifyDocumentByLines(mat) {
  try {
    if (!mat || mat.empty()) {
      return {
        ok: false,
        type: 'UNKNOWN',
        message: 'Invalid image'
      };
    }

    // Reject portrait
    if (mat.rows > mat.cols) {
      return {
        ok: false,
        type: 'PORTRAIT',
        message: 'Portrait images are not allowed. Please capture in landscape mode.'
      };
    }

    const f = extractLineFeatures(mat);

    const verticalCount = f.verticalCount;
    const horizontalCount = f.horizontalCount;

    console.log('Detected counts:', {
      verticalCount,
      horizontalCount
    });

    console.log('[Classifier] Line counts:', { verticalCount, horizontalCount });

    // Page 1 has a dense column grid (usually 11+ columns -> 12+ lines).
    // Minimum 10 vertical lines is a safe floor to ensure Page 2 (usually <= 8 lines) is excluded.
    const isPage1 =
      verticalCount >= 10 &&
      verticalCount <= 30 &&
      horizontalCount >= 8 &&
      horizontalCount <= 45;

    // Page 2 has fewer columns (usually 4-7 columns -> 5-8 lines).
    // Maximum 9 vertical lines ensures Page 1 is excluded.
    const isPage2 =
      verticalCount >= 2 &&
      verticalCount <= 9 &&
      horizontalCount >= 4 &&
      horizontalCount <= 50;

    if (isPage1) {
      return {
        ok: true,
        type: 'PAGE1',
        message: 'Detected Page 1 document',
        details: f
      };
    }

    if (isPage2) {
      return {
        ok: true,
        type: 'PAGE2',
        message: 'Detected Page 2 document',
        details: f
      };
    }

    // Fallback logic using the 10-line vertical boundary
    if (verticalCount >= 10) {
      return {
        ok: true,
        type: 'PAGE1',
        message: 'Detected Page 1 document (fallback — high vertical count)',
        details: f
      };
    }

    // Lower vertical count (<10) is much more likely to be Page 2
    return {
      ok: true,
      type: 'PAGE2',
      message: 'Detected Page 2 document (fallback)',
      details: f
    };
  } catch (err) {
    console.error('classifyDocumentByLines error:', err);
    return {
      ok: false,
      type: 'UNKNOWN',
      message: 'Unable to classify the document'
    };
  }
}